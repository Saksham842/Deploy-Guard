# 🛡️ DeployGuard

> **Automated quality gate and performance guardrail for pull requests.**
>
> DeployGuard is a full-stack GitHub App that monitors every PR for bundle size
> regressions, database query regressions, and API latency spikes. It posts
> GitHub Check Runs and PR comments with detailed metrics, NLP-powered cause
> analysis, and **AI-generated explanations** via Groq.

---

## ✨ Features

| Feature | Description | Trigger |
|---------|-------------|---------|
| **Performance Checks** | Measures bundle size, query count, API p95 latency against baselines | Every PR commit |
| **NLP Cause Classification** | Classifies commit messages into regression causes (local ML + Groq fallback) | After check completes |
| **🤖 AI Regression Explanation** | Groq explains *why* a regression happened in plain English, appended to the PR comment | On check **failure** |
| **🤖 AI Project Health Review** | Structured health report (Strengths / Risks / Recommendations) on the dashboard | User clicks "Generate AI Review" |
| **Dashboard** | React SPA with trend charts, stats cards, and check history | Real-time |

---

## 🏗️ Architecture

```
[GitHub PR Event]
       │
       ▼ (HMAC SHA-256)
┌──────────────────────┐     ┌──────────────────────────┐
│  Express.js Server   │────▶│  FastAPI NLP Service     │
│  (apps/server)       │     │  (apps/nlp)              │
│  • Webhooks          │     │  • /classify  (ML + LLM) │
│  • Check Runs        │     │  • /explain   (Groq)     │
│  • PR Comments       │     │  • /review    (Groq)     │
│  • REST API          │     └──────────┬───────────────┘
└──────────┬───────────┘                │
           │                            │ Groq API
           ▼                            ▼
┌──────────────────┐          ┌──────────────────┐
│  PostgreSQL      │          │  api.groq.com    │
│  (Neon / local)  │          │  /chat/completions│
└──────────────────┘          └──────────────────┘
           │
           ▼
┌──────────────────────┐
│  React Dashboard     │
│  (apps/web)          │
│  • Repo overview     │
│  • Trend charts      │
│  • AI Health Review  │
└──────────────────────┘
```

### AI Pipeline (3-Tier NLP Classification)

| Tier | Engine | Latency | Trigger |
|------|--------|---------|---------|
| 1 | `sentence-transformers` + LogisticRegression (local) | <50 ms | Confidence ≥ 0.55 |
| 2 | Groq `llama-3.1-8b-instant` | ~200 ms | Low ML confidence |
| 3 | Best ML guess (graceful) | — | Groq unavailable |

### AI Features (Groq-powered)

| Feature | Model | Temperature | Tokens | Endpoint |
|---------|-------|-------------|--------|----------|
| Regression Explanation | `llama-3.3-70b-versatile` | 0.3 | 600 | `POST /explain` |
| Project Health Review | `llama-3.3-70b-versatile` | 0.4 | 700 | `POST /review` |

Both features fail **gracefully** — if Groq is down the PR comment still posts
and the dashboard still renders.

---

## 🛠️ Tech Stack

| Layer | Technology | Location |
|-------|-----------|----------|
| **Webhook / API** | Node.js 20, Express, Octokit | `apps/server/` |
| **Database** | PostgreSQL (raw `pg`, no ORM) | `apps/server/src/db.js` |
| **NLP Service** | Python 3.11, FastAPI, scikit-learn, sentence-transformers | `apps/nlp/` |
| **AI (Groq)** | Groq API via `httpx` (Python) + `axios` (Node.js bridge) | `apps/nlp/groq_client.py` |
| **Frontend** | React 18, Vite, Tailwind CSS, Recharts | `apps/web/` |
| **CI/CD** | GitHub Actions (bundle artifact upload) | `docs/deployguard-action.yml` |

---

## 🚀 Local Development

### Prerequisites

- Node.js 20+
- Python 3.11+
- PostgreSQL 15+ (or a [Neon](https://neon.tech) connection)
- A [GitHub App](https://docs.github.com/en/apps) with webhook + checks permissions
- [ngrok](https://ngrok.com) (to route GitHub webhooks to localhost)

### 1. Install

```bash
git clone https://github.com/Saksham842/Deploy-Guard.git
cd Deploy-Guard

# JS dependencies (workspace root)
npm install

# Python dependencies + train local ML model
cd apps/nlp
pip install -r requirements.txt
python train_v2.py
```

### 2. Configure Environment

Copy `.env.example` to `.env` at the project root and fill in your values:

```bash
cp .env.example .env
```

Required variables:
| Variable | Description |
|----------|-------------|
| `GITHUB_APP_ID` | GitHub App ID |
| `GITHUB_WEBHOOK_SECRET` | Webhook secret (HMAC verification) |
| `GITHUB_PRIVATE_KEY` | Base64-encoded `.pem` private key |
| `GITHUB_CLIENT_ID` | GitHub OAuth App client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App client secret |
| `DATABASE_URL` | PostgreSQL connection string |
| `NLP_SERVICE_URL` | URL of the Python NLP service (`http://localhost:8000`) |
| `GROQ_API_KEY` | Groq API key for AI features ([get one free](https://console.groq.com)) |

### 3. Start Services

Run each in a separate terminal:

```bash
# Backend API (port 3000)
npm run dev:server

# React dashboard (port 5173)
npm run dev:web

# NLP microservice (port 8000)
cd apps/nlp && uvicorn main:app --reload --port 8000

# Webhook tunnel
ngrok http 3000
```

---

## 📁 Repository Structure

```
Deploy-Guard/
├── apps/
│   ├── server/                  # Node.js Express backend
│   │   ├── index.js             # Server entry point
│   │   ├── src/
│   │   │   ├── webhook.js       # GitHub App event handler
│   │   │   ├── comment.js       # PR comment builder (Markdown)
│   │   │   ├── db.js            # pg Pool + raw SQL queries
│   │   │   ├── routes/
│   │   │   │   └── api.js       # REST API (repos, checks, thresholds, ai-review)
│   │   │   ├── analysers/
│   │   │   │   ├── bundle.js    # Bundle size from CI artifact
│   │   │   │   └── packageDiff.js  # package.json diff
│   │   │   └── nlp/
│   │   │       └── client.js    # HTTP client to Python NLP service
│   │   └── utils/
│   │       └── groqExplain.js   # Bridge: server → NLP /explain
│   │
│   ├── nlp/                     # Python FastAPI NLP microservice
│   │   ├── main.py              # FastAPI app (4 endpoints)
│   │   ├── groq_client.py       # Shared Groq API wrapper
│   │   ├── ai_features.py       # explain_regression + review_repo
│   │   ├── train.py             # v1 TF-IDF training
│   │   ├── train_v2.py          # v2 sentence-transformers training
│   │   └── requirements.txt
│   │
│   └── web/                     # React + Vite dashboard
│       ├── src/
│       │   ├── App.jsx          # Router + auth
│       │   ├── pages/
│       │   │   ├── Dashboard.jsx
│       │   │   ├── RepoDetail.jsx     # Includes AIReviewCard
│       │   │   ├── Settings.jsx
│       │   │   └── ...
│       │   └── components/
│       │       ├── AIReviewCard.jsx   # "✨ Generate AI Review" button + report
│       │       ├── MetricChart.jsx
│       │       ├── CheckRow.jsx
│       │       └── ...
│       └── ...
│
├── db/migrations/               # Raw SQL migrations (no Prisma)
│   └── 001_initial.sql
├── .env.example
└── README.md
```

---

## 🔌 API Endpoints

### NLP Service (`apps/nlp` — FastAPI)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Service health + model metadata |
| `POST` | `/classify` | Classify commit messages (ML + Groq fallback) |
| `POST` | `/classify/single` | Classify one commit |
| `POST` | `/classify/batch` | Classify each commit independently |
| `POST` | `/explain` | **AI regression explanation (Groq)** |
| `POST` | `/review` | **AI project health review (Groq)** |

### Server API (`apps/server` — Express)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/health` | — | Server health |
| `GET` | `/auth/github` | — | GitHub OAuth redirect |
| `GET` | `/auth/github/callback` | — | OAuth callback |
| `GET` | `/api/repos` | Bearer | List repos |
| `GET` | `/api/repos/:owner/:name/checks` | Bearer | Recent checks (30) |
| `GET` | `/api/repos/:owner/:name/thresholds` | Bearer | Get threshold config |
| `PUT` | `/api/repos/:owner/:name/thresholds` | Bearer | Update thresholds |
| `GET` | `/api/repos/:owner/:name/ai-review` | Bearer | **AI health review report** |

---

## 🤖 AI Feature Details

### Feature 1: Regression Explanation

**Trigger:** Every time a DeployGuard check **fails** on a PR.

**Data sent to Groq:**
- Bundle delta (KB + %)
- Added / removed npm packages
- Commit messages
- NLP cause label (from `/classify`)

**Output:** GitHub-flavored Markdown appended to the PR comment under
`### 🤖 DeployGuard AI Analysis`.

**Guarantees:**
- Always covers WHAT → WHY → HOW in 5 bullets max
- Ends with a copy-pasteable fix command
- Never invents package names
- If Groq fails, the section is omitted (no placeholder)

### Feature 2: Project Health Review

**Trigger:** User clicks "✨ Generate AI Review" on the repo detail page.

**Data aggregated from PostgreSQL:**
- Total / passed / failed checks
- Average bundle size + worst regression (KB)
- Most common NLP cause
- Recently added packages (deduplicated)

**Output:** Three-section report with exact headers:
- `✅ Strengths` (3 bullets)
- `⚠️ Risks` (3 bullets)
- `🔧 Recommendations` (3 bullets)

**Safety:**
- If pass rate < 70% → flagged as *critical* in Risks
- If worst regression > 100 KB → flagged as *serious concern*
- If Groq fails → shows `"AI review temporarily unavailable."`
- The dashboard page **never breaks**

---

## 🧪 Running Tests

```bash
cd apps/server
npm test
```

---

*Project created and maintained by [Saksham Hans](https://github.com/Saksham842).*
