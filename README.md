# 🛡️ DeployGuard

> **DeployGuard is a automated quality gate and performance guardrail for pull requests.** Built as an event-driven GitHub App, it measures bundle size, database query counts, and API response latency on every commit. If a pull request regresses performance past configurable limits, DeployGuard blocks the merge and runs commit messages through an **NLP Causation Engine** to explain *why* the regression happened.

---

## 🎯 The Problem & Solution

### The Problem
In modern fast-moving teams, performance regression is a "boiling frog" problem. A developer adds a heavy library, writes an inefficient N+1 database query, or introduces blocking CPU-heavy operations. Individually, these changes seem harmless, but collectively they degrade the user experience over time. Standard CI/CD tools check if tests pass, but they rarely verify if the application remains *fast*.

### The Solution
DeployGuard acts as a native gatekeeper:
1. **GitHub App Hooks**: Subscribes to `pull_request` hooks to run automated performance audits.
2. **Metrics baseline comparison**: Compares commit metrics against PostgreSQL baseline targets.
3. **Automated Check Runs & PR Comments**: Posts status checks and comments directly on the pull request with a detailed breakdown.
4. **Causation Engine**: Classifies git history using a local embedding model and fallback LLM to diagnose the root cause of performance shifts.

---

## 🏗️ Architecture & Data Flow

DeployGuard is designed as a modular, event-driven microservices architecture spanning three environments:

```
                  [ GitHub PR Event ]
                           │
                           ▼ (HMAC SHA-256 Verified)
            ┌─────────────────────────────┐
            │  Express.js Webhook Server  │
            │  (apps/server)              │
            └──────────────┬──────────────┘
                           │
             ┌─────────────┴─────────────┐
             ▼                           ▼
      analyseBundle()             classifyCommits()
      diffPackageJson()                  │
             │                           ▼
             │            ┌──────────────────────────────┐
             │            │  FastAPI NLP Microservice    │
             │            │  (apps/nlp)                  │
             │            └──────────────┬───────────────┘
             │                           │
             └─────────────┬─────────────┘
                           ▼
              [ Save Metrics to Neon DB ]
                           │
                           ▼
             [ Update GitHub Check Status ]
             [ Post Automated PR Comment ]
```

### Key Engineering Decisions

* **3-Tier NLP Pipeline (Local ML → Groq LLM → Best Guess)**:
  * **Tier 1 (Offline Local ML)**: Uses `sentence-transformers/all-MiniLM-L6-v2` to generate 384-dimensional semantic embeddings. If the local classifier's confidence score is $\ge 0.55$, it returns in `<50ms` without API costs.
  * **Tier 2 (Cloud LLM Fallback)**: If the local model is unsure (e.g. vague commits like `"fix stuff"`), it calls Groq's `llama-3.1-8b-instant` to analyze the context.
  * **Tier 3 (Graceful Degradation)**: If Groq is rate-limited or offline, it falls back to the top local guess, maintaining system availability.
* **Service Isolation**: The Python NLP service is completely separated from the Express.js backend. This decouples CPU-bound machine learning tasks from the I/O-bound webhook receiver, allowing independent deployment and fallback handling.
* **Strict Baseline Integrity**: Baselines are updated *only* when a PR successfully merges into the primary branch *and* passes all performance thresholds. This guarantees that temporary failures or unmerged experiments never pollute baseline targets.
* **Zero-Trust Token Exchange**: The backend verifies incoming webhooks using HMAC-SHA256, generates short-lived RS256 JWTs, and requests temporary installation tokens scoped strictly to the active repository.

---

## 🛠️ Technology Stack

* **Frontend Dashboard (`apps/web`)**: React 18, Vite, Tailwind CSS, Recharts. Single Page Application (SPA) showcasing repository trend lines, metrics cards, and check history.
* **Backend API (`apps/server`)**: Node.js, Express, Prisma, PostgreSQL (Neon), Octokit App. Handles incoming webhook payloads, authentication, and database writes.
* **NLP Causation Service (`apps/nlp`)**: Python 3.11, FastAPI, Docker, `sentence-transformers`, `scikit-learn`. Converts git commit messages to vector embeddings to predict regression causes.

---

## 🚀 Local Development Setup

### Prerequisites
* Node.js 20+
* Python 3.11+
* PostgreSQL 15+ (or Neon connection)
* A [GitHub App](https://docs.github.com/en/apps) configuration
* [ngrok](https://ngrok.com) (to route GitHub webhooks locally)

### 1. Installation

```bash
git clone https://github.com/Saksham842/Deploy-Guard.git
cd Deploy-Guard

# Install JS dependencies at workspace root
npm install

# Setup Python environment and train local model
cd apps/nlp
pip install -r requirements.txt
python train_v2.py
```

### 2. Configure Environment

Copy `.env.example` to `.env` in the root directory:
```bash
cp .env.example .env
```
Ensure you set the required variables: `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, `DATABASE_URL`, and `NLP_SERVICE_URL`.

### 3. Start Services

Run each in a separate terminal:
```bash
# Start backend API (port 3000)
npm run dev:server

# Start React app (port 5173)
npm run dev:web

# Start FastAPI server (port 8000)
cd apps/nlp && uvicorn main:app --reload --port 8000

# Route webhook traffic
ngrok http 3000
```

---

## 📁 Repository Structure

```
Deploy-Guard/
├── apps/
│   ├── server/       # Node.js Express Backend & Webhook Receiver
│   ├── web/          # React + Vite Frontend Dashboard
│   └── nlp/          # Python FastAPI Causation Microservice
├── db/               # Prisma Database Schemas & Migrations
├── render.yaml       # Infrastructure-as-code blueprint for Render
├── package.json      # Monorepo workspaces definition
└── .env.example      # Reference configuration environment template
```

---

*Project created and maintained by [Saksham Hans](https://github.com/Saksham842).*
