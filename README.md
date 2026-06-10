# 🛡️ DeployGuard

> **DeployGuard is a full-stack GitHub App that baselines your application's performance on every deploy. It blocks Pull Requests that regress bundle size, query speed, or API latency — and uses an NLP Causation Engine to explain exactly *why* the regression happened based on commit messages and package diffs.**

[![Node.js](https://img.shields.io/badge/Node.js-20-green)](https://nodejs.org)
[![Python](https://img.shields.io/badge/Python-3.11-blue)](https://python.org)
[![React](https://img.shields.io/badge/React-18-61dafb)](https://reactjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue)](https://postgresql.org)
[![Vercel](https://img.shields.io/badge/Frontend-Vercel-black)](https://vercel.com)
[![Render](https://img.shields.io/badge/Backend-Render-46E3B7)](https://render.com)
[![NLP](https://img.shields.io/badge/NLP-sentence--transformers-orange)](https://www.sbert.net)
[![Groq](https://img.shields.io/badge/Fallback-Groq%20LLM-f55036)](https://console.groq.com)

---

## ✨ Key Features

1. **GitHub App Integration** — Installs seamlessly and subscribes to `pull_request` events to run automated audits.
2. **Performance Baselines** — Automatically measures bundle size, query counts, and API latency. Updates the permanent baseline *only* when a PR successfully merges into `main`.
3. **Automated Checks & Comments** — Posts a native GitHub Check Run (pass/fail) and injects a detailed PR comment with a breakdown of performance deltas.
4. **NLP Root Cause Analysis (v2)** — Uses a Python FastAPI microservice with a `sentence-transformers` semantic embedding model (all-MiniLM-L6-v2) trained on 380+ developer commit messages across 10 categories — including `bundle_size`, `query_regression`, `latency_spike`, and `dependency_bloat`.
5. **Modern Dashboard** — A sleek, dark-mode React (Vite) dashboard built with custom glassmorphism components to view real-time repository stats.

---

## 🏗️ Architecture & Data Flow

DeployGuard is designed as a distributed, event-driven microservices architecture spanning **three cloud providers**.

```
GitHub PR Event
      │
      ▼
┌─────────────────────────────┐
│  Express.js Webhook Server  │  ← Render Web Service #1
│  (apps/server)              │
│  - HMAC signature verify    │
│  - Octokit GitHub API       │
│  - PostgreSQL / Prisma      │
└────────────┬────────────────┘
             │
     ┌───────┼───────────────────────────┐
     │       │                           │
     ▼       ▼                           ▼
analyseBundle()           classifyCommits()
diffPackageJson()               │
  CI Artifact Parsing    ┌──────▼──────────────────────┐
  GitHub API REST        │  FastAPI NLP Microservice    │  ← Render Web Service #2
                         │  (apps/nlp)                  │
                         │  - sentence-transformers v2  │
                         │  - 10-class classifier       │
                         │  - /classify + /batch + /health│
                         └──────────────────────────────┘
             │
             ▼
    Save Metrics → PostgreSQL
             │
             ▼
    Update GitHub Check Run
    Post Automated PR Comment
             │
             ▼
┌────────────────────────────┐
│  React + Vite Dashboard    │  ← Vercel
│  (apps/web)                │
│  - Live repo stats         │
│  - Dark mode glassmorphism │
└────────────────────────────┘
```

---

## 🚀 Deployment Architecture

DeployGuard is deployed across **three cloud providers**:

| Service | Provider | Plan | Notes |
|---------|----------|------|-------|
| **Backend API** (`apps/server`) | [Render](https://render.com) | Free Web Service | Node.js + Express webhook server, PostgreSQL via `DATABASE_URL` |
| **NLP Engine** (`apps/nlp`) | [Render](https://render.com) | Free Web Service | Python FastAPI + sentence-transformers, Dockerized, auto-trains at build |
| **Frontend Dashboard** (`apps/web`) | [Vercel](https://vercel.com) | Free Hobby | React + Vite SPA, edge-cached globally |

### Render Services (render.yaml)

Both backend services are defined in [`render.yaml`](./render.yaml) at the repo root:

- **`deployguard-server`** — Node.js web service running `npm start` in `apps/server`
- **`deployguard-nlp`** — Docker-based web service built from `apps/nlp/Dockerfile`, trains the model at image build time and serves on port `8000`

### Vercel (Frontend)

The `apps/web` Vite app is deployed directly from this repo via Vercel's GitHub integration:
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Root directory:** `apps/web`

---

## 🧠 NLP Model — v2 (sentence-transformers + Groq fallback)

The NLP Causation Engine was upgraded from TF-IDF to **semantic sentence embeddings**, with a **Groq LLM fallback** for vague or ambiguous commits.

| | v1 (TF-IDF) | v2 (sentence-transformers) |
|---|---|---|
| **Model** | TF-IDF + LogisticRegression | all-MiniLM-L6-v2 + LogisticRegression |
| **Embedding** | Bag-of-words n-grams | 384-dim semantic vectors |
| **Dataset** | ~200 examples, 6 classes | ~380 examples, 10 classes |
| **Semantic similarity** | ❌ | ✅ "fixed slow query" ≈ "optimized DB call" |
| **New classes** | — | `bundle_size`, `query_regression`, `latency_spike`, `dependency_bloat` |
| **Model file** | `commit_classifier.joblib` | `model_v2.pkl` |
| **Train script** | `train.py` | `train_v2.py` |
| **LLM fallback** | ❌ | ✅ Groq `llama-3.1-8b-instant` |

### 3-Tier Classification Pipeline

Every commit message goes through this pipeline in order:

```
Commit message: "updated readme"
       │
       ▼
┌─────────────────────────────────────────┐
│  Tier 1: Local ML Model                 │
│  sentence-transformers/all-MiniLM-L6-v2 │
│  + LogisticRegression                   │
│                                         │
│  confidence = 0.48  (< 0.55 threshold)  │
└────────────────┬────────────────────────┘
                 │  low confidence → escalate
                 ▼
┌─────────────────────────────────────────┐
│  Tier 2: Groq LLM Fallback              │  ← only if GROQ_API_KEY set
│  llama-3.1-8b-instant (free)            │
│  ~200ms, zero cost on free tier         │
│                                         │
│  → cause: "chore", confidence: 0.91     │
└────────────────┬────────────────────────┘
                 │  if Groq unavailable
                 ▼
┌─────────────────────────────────────────┐
│  Tier 3: Return best ML guess anyway    │
│  with low_confidence flag in response   │
└─────────────────────────────────────────┘
```

**What this means for real commit messages:**

| Commit message | ML result | Groq kicks in? | Final answer |
|---|---|---|---|
| `add framer-motion library` | `bundle_size` 0.89 | ❌ ML is confident | `bundle_size` 0.89 |
| `updated readme` | `chore` 0.48 | ✅ Yes | `chore` 0.91 via Groq |
| `added nlp` | `feature` 0.51 | ✅ Yes | `feature` 0.87 via Groq |
| `wip` | `unknown` 0.72 | ❌ ML confident | `unknown` 0.72 |
| `n+1 query in user feed` | `query_regression` 0.94 | ❌ ML confident | `query_regression` 0.94 |

**Classifier output (v2):**
```json
{
  "cause": "bundle_size",
  "confidence": 0.94,
  "all_scores": {
    "bundle_size": 0.94,
    "query_regression": 0.03,
    "latency_spike": 0.02,
    "dependency_bloat": 0.01
  },
  "model_version": "v2-sentence-transformers"
}
```

**All 10 classes:**

| Class | Description |
|-------|-------------|
| `bundle_size` | New UI libraries, large frontend packages |
| `query_regression` | N+1 queries, missing indexes, unbounded fetches |
| `latency_spike` | Blocking I/O, CPU-heavy operations in request path |
| `dependency_bloat` | Lockfile bloat, transitive dep changes, forced upgrades |
| `new_dependency` | Net-new npm/pip package added |
| `asset_added` | Images, fonts, videos, icons added to static assets |
| `feature` | New product functionality implemented |
| `refactor` | Code restructure with no functional change |
| `chore` | Docs, config, formatting, version bumps |
| `unknown` | Uninformative commit messages (wip, fix, temp…) |

---

## 🛠️ Tech Stack

### Frontend (`apps/web`) — Vercel
- **React 18 + Vite** — Fast HMR, optimized production builds
- **Vanilla CSS + CSS Variables** — Custom design system: glassmorphism, micro-animations, vibrant gradients
- **React Router** — Protected routing with GitHub OAuth integration

### Backend (`apps/server`) — Render Web Service #1
- **Node.js + Express** — REST API and Webhook receiver
- **@octokit/app & @octokit/rest** — GitHub App integration: JWT generation, installation tokens, check-run management
- **PostgreSQL + Prisma** — Relational database for repos, users, baselines, and check runs
- **HMAC-SHA256** — Cryptographic webhook signature verification

### NLP Engine (`apps/nlp`) — Render Web Service #2
- **Python 3.11 + FastAPI** — High-performance async API
- **sentence-transformers** (`all-MiniLM-L6-v2`) — 22MB CPU model, semantic embeddings, no API key needed
- **scikit-learn** `LogisticRegression` — Fast inference, class-balanced, confidence scores
- **Docker** — Model is trained at image build time; zero cold-start model loading

---

## ⚡ Quick Start (Local Development)

### Prerequisites
- Node.js 20+, Python 3.11+, PostgreSQL 15+
- A configured [GitHub App](https://docs.github.com/en/developers/apps)
- [ngrok](https://ngrok.com) for localhost webhook routing

### 1. Clone & Install

```bash
git clone https://github.com/Saksham842/Deploy-Guard.git
cd Deploy-Guard

# Install all JS dependencies (monorepo workspaces)
npm install

# Install Python dependencies and train NLP model v2
cd apps/nlp
pip install -r requirements.txt
python train_v2.py     # builds model_v2.pkl
uvicorn main:app --reload --port 8000
```

### 2. Environment Variables

Copy `.env.example` to `.env` in the project root and fill in all values:

```bash
cp .env.example .env
```

| Variable | Description | Where |
|----------|-------------|-------|
| `GITHUB_APP_ID` | Your GitHub App's numeric ID | Root `.env` |
| `GITHUB_WEBHOOK_SECRET` | Random 32-byte hex string | Root `.env` |
| `GITHUB_PRIVATE_KEY` | Base64-encoded `.pem` file | Root `.env` |
| `GITHUB_CLIENT_ID` | OAuth App client ID | Root `.env` |
| `GITHUB_CLIENT_SECRET` | OAuth App client secret | Root `.env` |
| `DATABASE_URL` | PostgreSQL connection string | Root `.env` |
| `NLP_SERVICE_URL` | URL of FastAPI service | Root `.env` |
| `GROQ_API_KEY` | Groq API key for LLM fallback (optional but recommended) | Root `.env` + Render NLP service |
| `VITE_API_URL` | Backend URL for frontend | `apps/web/.env` |

### 3. Start All Services

```bash
# Terminal 1 — Node.js backend (port 3000)
npm run dev:server

# Terminal 2 — React frontend (port 5173)
npm run dev:web

# Terminal 3 — Python NLP service (port 8000)
cd apps/nlp && uvicorn main:app --reload --port 8000

# Terminal 4 — ngrok (expose webhook to GitHub)
ngrok http 3000
```

### 4. Run Database Migrations

```bash
npm run migrate
```

---

## 🌐 Deploying to Production

### Render (Backend + NLP)

1. Connect your GitHub repo in the [Render Dashboard](https://dashboard.render.com)
2. Click **"New → Blueprint"** and select this repo — Render auto-reads `render.yaml`
3. Set all environment variables from `.env.example` in each service's settings
4. Both services deploy automatically on every push to `main`

> **NLP cold-start note:** Render free-tier services spin down after inactivity. The NLP service trains the model at Docker build time, so there is no model-loading delay on wake — only the standard free-tier HTTP cold start (~30s).

### Vercel (Frontend)

1. Import the repo in [Vercel Dashboard](https://vercel.com/new)
2. Set **Root Directory** → `apps/web`
3. Add environment variables: `VITE_API_URL`, `VITE_GITHUB_CLIENT_ID`
4. Deploy — Vercel automatically detects Vite and configures the build

---

## 🔐 Core Engineering Decisions

### 1. 3-Tier NLP: Local Model → Groq LLM → Best Guess
DeployGuard v2 uses a **layered classification strategy**:
- **Tier 1 — sentence-transformers** (`all-MiniLM-L6-v2`): 22MB CPU model, runs offline, classifies confident commits in <50ms. Semantically similar commits map to nearby vectors without exact token matching.
- **Tier 2 — Groq LLM** (`llama-3.1-8b-instant`): Free-tier LLM called only when local model confidence drops below 0.55. Handles vague messages like `"updated readme"` or `"added nlp"` that the local model isn't trained on. ~200ms, no cost on Groq free tier.
- **Tier 3 — Graceful degradation**: If Groq is unavailable or unset, returns the best local ML guess rather than failing. The `via_groq` flag in the response tells you which tier answered.

### 2. Two Render Services, Not One
The NLP engine is intentionally isolated from the Node.js backend as a separate Render web service:
- **Language isolation** — Python/FastAPI never touches Node internals
- **Independent scaling** — NLP can be upgraded or replaced without touching the webhook server
- **Failure isolation** — If the NLP service is cold, the backend degrades gracefully (returns `unknown`) rather than failing the entire check run

### 3. Zero-Trust GitHub Authentication
- The Node.js server signs a short-lived JWT using an RSA private key
- It exchanges the JWT for a temporary Installation Access Token scoped **strictly** to the repository triggering the webhook
- Incoming webhooks are verified with HMAC-SHA256 to prevent spoofing

### 4. Strict Baseline Integrity
Performance baselines are only updated when a PR is **successfully merged** into `main`/`master` **and** the performance check passes — preventing the "boiling frog" problem of gradual undetected regression.

---

## 📁 Project Structure

```
Deploy-Guard/
├── apps/
│   ├── server/              # Node.js + Express (Render Web Service #1)
│   │   ├── src/
│   │   ├── scripts/
│   │   └── package.json
│   ├── web/                 # React + Vite (Vercel)
│   │   ├── src/
│   │   └── package.json
│   └── nlp/                 # Python FastAPI (Render Web Service #2)
│       ├── train.py         # v1: TF-IDF training (legacy)
│       ├── train_v2.py      # v2: sentence-transformers training ✨
│       ├── main.py          # FastAPI server
│       ├── model_v2.pkl     # Trained model (git-ignored, built at Docker build)
│       ├── requirements.txt
│       └── Dockerfile
├── db/
│   └── migrations/
├── render.yaml              # Render Blueprint (both backend services)
├── package.json             # npm workspaces root
└── .env.example
```

---

<div align="center">
  <b>Built by Saksham Hans</b><br/>
  <sub>Node.js · Python · React · PostgreSQL · Render · Vercel</sub>
</div>
