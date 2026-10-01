# 🛡️ DeployGuard

> **Automated performance quality gates, multi-bundler tracking, and AI-powered regression analysis for Pull Requests.**
>
> DeployGuard is a full-stack, enterprise-grade GitHub App that detects and blocks performance regressions (bundle size bloat, database N+1 query regressions, and API latency spikes) *before* they hit production. It automatically opens zero-configuration setup PRs for new repos, generates native GitHub Check Runs and rich PR comments, identifies recurring regression patterns, and provides visual chunk-level breakdowns with Groq-powered AI explanations.

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)](https://python.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%2B-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Groq](https://img.shields.io/badge/Groq-LLaMA%203.1-F55036?logo=groq&logoColor=white)](https://console.groq.com/)

---

## 🚀 Key Highlights & Capabilities

- **⚡ Zero-Friction Onboarding** — Installing the GitHub App automatically detects your build tool (`Vite`, `Next.js`, `Webpack`, `Create React App`) and creates a ready-to-merge setup PR (`deployguard/setup`) containing the exact GitHub Actions workflow needed.
- **📦 Multi-Bundler Support** — Unified parsing engine normalizes build manifests from Vite (`dist/assets`), Next.js (`.next/build-manifest.json`), and Webpack (`stats.json`) into consistent chunk metrics.
- **🔍 Real Database Query Regression Guard** — Detects N+1 queries, unindexed lookups, and unbounded fetch loops by ingesting test-suite query counts via `@deployguard/query-counter` or lightweight ORM middleware (Prisma, TypeORM, Drizzle).
- **🔁 Webhook Idempotency & Resilient Pipeline** — Database constraints (`uniq_repo_pr_sha`) and `x-github-delivery` deduplication prevent race conditions. Artifact downloads feature exponential retry backoff (250ms, 1s, 4s) to tolerate GitHub API availability delays.
- **📊 Visual Chunk Diff Breakdown** — Pinpoints the top 5 chunks with the highest size deltas between PR head and base commits, rendered as horizontal visual bar charts directly inside the dashboard.
- **⚠️ Proactive Trend Warnings** — Historical pattern analyzer flags recurring regression causes across recent failing checks (e.g. flagging repeated dependency additions or unpaginated queries).
- **🤖 3-Tier NLP & Dual-Path AI Diagnostics** — Commits are classified by a local SentenceTransformer model (<50ms, Tier 1) with Groq LLaMA 3.1-8b fallback (Tier 2). Actionable markdown explanations and copy-pasteable fix commands are posted directly onto PRs.
- **💻 Developer-Grade UI** — Built on a high-contrast near-black technical token system (`#0D0F12`, `#161A1F`, `#252B32`), signal green/red pass/fail indicators, expandable check detail rows, and functional monospace typography.

---

## 🏗️ Architecture Overview

DeployGuard uses a **decentralized measurement pattern** to guarantee security, scalability, and zero compute overhead:

```
[ Developer opens PR / pushes code ]
        │
        ▼
[ GitHub Actions Runner ]  ── builds app + runs tests ──▶ uploads bundle-stats artifact
        │                                                 (stats.json + query-stats.json)
        │  workflow_run.completed webhook
        ▼
[ Express.js Webhook Server ]  ── downloads artifact with backoff ──▶ normalizes metrics
        │
        ├──▶ [ PostgreSQL ]       (stores repos, baselines, checks, causes, trends)
        │
        └──▶ [ FastAPI NLP Service ]
                    │
                    ├── Local SentenceTransformer classifier  (<50 ms, Tier 1)
                    ├── Groq LLaMA 3.1-8b fallback           (~200 ms, Tier 2)
                    └── Graceful degradation                  (Tier 3)
                    │
                    ▼  Structured Explanation & Summaries
        │
        ▼
[ GitHub Check Run + PR Comment ] posted directly back to the Pull Request
        │
        ▼
[ React 18 Technical Dashboard ] — visual chunk diffs, trend graphs, threshold gates
```

### Service Map

| Service | Stack | Port | Responsibility |
|---------|-------|------|----------------|
| `apps/server` | Node.js 20 · Express 4 · @octokit/app | `3000` | Webhook ingestion, tool detection, auto-PRs, DB, OAuth |
| `apps/nlp` | Python 3.11 · FastAPI · SentenceTransformers | `8000` | ML commit classification, Groq LLaMA 3.1 explanations |
| `apps/web` | React 18 · Vite · Recharts · Tailwind CSS | `5173` | Developer dashboard, visual chunk diffs, threshold controls |

---

## 📁 Project Structure

```
Deploy-Guard/
│
├── .github/
│   └── workflows/
│       └── bundle-analysis.yml          # DeployGuard's self-monitoring CI & test pipeline
│
├── apps/
│   │
│   ├── server/                          # Node.js · Express · @octokit/app
│   │   ├── index.js                     # Server bootstrap & CORS
│   │   ├── Dockerfile                   # Production container
│   │   ├── package.json
│   │   ├── test/
│   │   │   └── pipeline.test.js         # End-to-end smoke test (PR open → workflow completed)
│   │   └── src/
│   │       ├── webhook.js               # Webhook event orchestrator (PR, workflow_run, installation)
│   │       ├── detect.js                # Automatic build tool detector (Vite, Next.js, Webpack, CRA)
│   │       ├── workflowTemplates.js     # Tool-specific GitHub Actions workflow generator
│   │       ├── metrics.js               # Pass/fail threshold and delta computation
│   │       ├── comment.js               # Markdown PR comment builder
│   │       ├── db.js                    # PostgreSQL pool, queries, trends, auto-migrations
│   │       ├── analysers/
│   │       │   ├── bundle.js            # Multi-format artifact parser & computeChunkDiff
│   │       │   └── packageDiff.js       # package.json diffing between base and head SHA
│   │       ├── nlp/
│   │       │   └── client.js            # Client for the FastAPI NLP service
│   │       ├── routes/
│   │       │   └── api.js               # REST routes for repos, checks, thresholds, setup status
│   │       ├── utils/
│   │       │   └── groqExplain.js       # Dual-path Groq AI client with local fallback
│   │       └── __tests__/
│   │           ├── bundle.test.js       # Unit tests for multi-format parser & chunk diffing
│   │           ├── onboarding.test.js   # Unit tests for tool detection & workflow templates
│   │           ├── queryCount.test.js   # Unit tests for query_count metric delta computation
│   │           └── webhook.test.js      # Webhook handling unit tests
│   │
│   ├── nlp/                             # Python 3.11 · FastAPI · SentenceTransformers · Groq
│   │   ├── main.py                      # FastAPI routes (/classify, /explain, /summarize, /review)
│   │   ├── ai_features.py               # Groq prompts for regressions, summaries, and reviews
│   │   ├── groq_client.py               # Shared async Groq API client
│   │   ├── train_v2.py                  # Trains SentenceTransformer model (incl. query regressions)
│   │   ├── model_v2.pkl                 # Baked serialized model
│   │   ├── requirements.txt
│   │   └── Dockerfile                   # Production container
│   │
│   └── web/                             # React 18 · Vite · Recharts · Tailwind CSS
│       ├── index.html
│       ├── vite.config.js
│       ├── src/
│       │   ├── App.jsx                  # Application router
│       │   ├── api.js                   # API client
│       │   ├── index.css                # Technical design token system & hairline panels
│       │   ├── components/
│       │   │   ├── AIReviewCard.jsx     # AI health review with visual chunk diff (Recharts BarChart)
│       │   │   ├── Badge.jsx            # Technical signal pass/fail badge
│       │   │   ├── CheckRow.jsx         # Expandable row with semantic status stripe
│       │   │   ├── MetricChart.jsx      # Technical dark Recharts trendline with baseline markers
│       │   │   ├── Navbar.jsx           # Monospace user nav & repository links
│       │   │   ├── ParticleBackground.jsx # Minimalist technical coordinate grid background
│       │   │   └── RepoCard.jsx         # Flat panel card with active focal point indicator
│       │   └── pages/
│       │       ├── Dashboard.jsx        # Repository list, setup banners, active repository focus
│       │       ├── RepoDetail.jsx       # Hero trendline, check history table, chunk breakdown
│       │       ├── Settings.jsx         # Threshold configuration UI
│       │       ├── Login.jsx            # Landing page with GitHub OAuth
│       │       ├── Docs.jsx             # In-app reference & setup documentation
│       │       └── AuthCallback.jsx     # OAuth redirect handler
│       └── dist/                        # Production build bundle
│
├── db/
│   └── migrations/
│       ├── 001_initial.sql              # Base schema (repos, baselines, checks, causes, users)
│       ├── 002_idempotency.sql          # Unique constraints and delivery ID indexing
│       ├── 003_onboarding.sql           # Build tool and setup PR tracking columns
│       └── 004_query_tracking.sql       # Query tracking enabled threshold configuration
│
├── docs/
│   ├── onboarding.md                    # Manual setup workflow documentation
│   └── query-tracking.md                # ORM integration guide for query count tracking
│
├── package.json                         # npm workspaces root
└── render.yaml                          # Render deployment configuration
```

---

## 💾 Database Schema

The server self-migrates on boot (`db.js` auto-creates tables and idempotent constraints). The `db/migrations/` SQL files serve as formal versioned references:

```mermaid
erDiagram
    repos ||--o{ baselines : "has"
    repos ||--o{ checks : "has"
    checks ||--o{ regression_causes : "contains"
    users ||--o{ repos : "administers"

    repos {
        uuid id PK
        bigint github_repo_id UK
        text owner
        text name
        bigint install_id
        text build_tool
        text setup_pr_url
        text setup_status
        jsonb threshold_config
        timestamptz created_at
    }
    baselines {
        uuid id PK
        uuid repo_id FK
        text branch
        text metric
        numeric value
        text commit_sha
        timestamptz recorded_at
    }
    checks {
        uuid id PK
        uuid repo_id FK
        int pr_number
        text head_sha
        text base_sha
        text status
        text github_delivery_id
        jsonb results
        timestamptz created_at
    }
    regression_causes {
        uuid id PK
        uuid check_id FK
        text cause_type
        text detail
        numeric confidence
        timestamptz created_at
    }
    users {
        uuid id PK
        bigint github_user_id UK
        text username
        text avatar_url
        text access_token
        timestamptz created_at
    }
```

### Table Descriptions

| Table | Purpose |
|-------|---------|
| `repos` | Repository metadata, detected `build_tool`, automated `setup_pr_url`, `setup_status` (`pending`, `pr_open`, `merged`), and threshold configuration JSONB |
| `baselines` | Per-branch recorded snapshots of `bundle_kb`, `query_count`, and `api_p95_ms` — the ground-truth values all PRs are evaluated against |
| `checks` | Analysis runs per PR; enforces uniqueness on `(repo_id, pr_number, head_sha)` and tracks `github_delivery_id` for idempotency |
| `regression_causes` | NLP classification output — cause type (e.g. `new_dependency`, `query_regression`, `asset_added`) with confidence rating |
| `users` | Authenticated users via GitHub OAuth |

---

## 🔢 Database Query Count Tracking Contract

DeployGuard supports tracking database query frequencies during test suites to catch N+1 queries before merge:

### Producer Contract
Tenant test runners output `dist/query-stats.json` alongside `dist/stats.json`:
```json
{
  "queryCount": 42
}
```

### Prisma Example Setup
Add this to your Jest / Vitest test setup file (`setupTests.ts`):
```typescript
import fs from 'fs';
import { prisma } from './prismaClient';

let queryCount = 0;

prisma.$use(async (params, next) => {
  queryCount++;
  return next(params);
});

afterAll(() => {
  if (!fs.existsSync('dist')) fs.mkdirSync('dist', { recursive: true });
  fs.writeFileSync('dist/query-stats.json', JSON.stringify({ queryCount }));
});
```

Upload both files in the same `bundle-stats` artifact step:
```yaml
- name: Upload bundle & query stats
  uses: actions/upload-artifact@v4
  with:
    name: bundle-stats
    path: dist/
```

Enable query tracking per repository in the **Settings** view or via threshold configuration (`query_tracking_enabled: true`).

---

## 🤖 NLP Pipeline & Cause Classes

The commit classification pipeline categorizes commit messages into semantic root causes:

```
Commit messages  ──▶  Tier 1: Local SentenceTransformer (all-MiniLM-L6-v2)
                               Latency: <50 ms  |  Cost: $0
                               ↓ confidence < 0.55
                       Tier 2: Groq LLaMA 3.1-8b-instant
                               Latency: ~200 ms  |  Cost: minimal
                               ↓ rate-limited / offline
                       Tier 3: Top local prediction (graceful degradation)
```

**10 Semantic Commit Classes:**
- `new_dependency`: A new package was added
- `dependency_upgrade`: An existing package was upgraded
- `query_regression`: N+1 query patterns, missing database indexes, unpaginated fetches
- `latency_spike`: Blocking synchronous I/O or heavy computation in request paths
- `asset_added`: Heavy static assets (images, fonts, PDFs, icons) bundled
- `feature`: New component or product feature
- `refactor`: Structural code cleanup with no functional change
- `fix`: Bug fix commits
- `test`: Test harness additions
- `chore` / `docs`: Config or documentation changes

---

## 🔌 API Reference

### Backend API (`apps/server` — Express, Port `3000`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/auth/github` | — | Initiates GitHub OAuth authentication |
| `GET` | `/auth/github/callback` | — | Exchanges code for access token, stores user, redirects to web |
| `GET` | `/api/repos` | Bearer | Lists all connected repositories with latest check and setup state |
| `GET` | `/api/repos/:owner/:name/checks` | Bearer | Retrieves check runs with regression causes for a repo |
| `GET` | `/api/repos/:owner/:name/setup` | Bearer | Returns automated setup PR URL and onboarding status |
| `GET` | `/api/repos/:owner/:name/thresholds` | Bearer | Returns repository threshold configuration gates |
| `PUT` | `/api/repos/:owner/:name/thresholds` | Bearer | Updates threshold limits and query tracking toggles |
| `GET` | `/api/repos/:owner/:name/ai-review` | Bearer | Returns Groq AI health report, recurring trend warnings, and chunk diffs |
| `POST` | `/api/github/webhooks` | HMAC | Signed GitHub App webhook receiver |

### NLP Service (`apps/nlp` — FastAPI, Port `8000`)

| Method | Endpoint | Request Body | Description |
|--------|----------|--------------|-------------|
| `POST` | `/classify` | `{ message: string }` | Classifies a single commit message |
| `POST` | `/classify/batch` | `{ messages: string[] }` | Classifies multiple commit messages |
| `POST` | `/explain` | `{ bundle_delta_kb, added_packages, ... }` | Generates a 3-part regression explanation |
| `POST` | `/summarize` | `{ bundle_delta_kb, ... }` | Generates positive check summary for passing PRs |
| `POST` | `/review` | `{ repo_name, trend_warning, ... }` | Generates structured project health review |
| `GET`  | `/health` | — | Health check probe |

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- **Node.js** 20+
- **Python** 3.11+
- **PostgreSQL** 15+ (local or [Neon](https://neon.tech))
- **GitHub App** with `Checks: write`, `Pull requests: write`, `Contents: write`, `Actions: read` permissions.

### 1. Installation

```bash
git clone https://github.com/Saksham842/Deploy-Guard.git
cd Deploy-Guard

# Install root workspaces (server + web)
npm install

# Setup NLP service virtual environment
cd apps/nlp
python -m venv venv

# Activate virtualenv
source venv/bin/activate       # macOS / Linux
# .\venv\Scripts\activate    # Windows PowerShell

pip install -r requirements.txt
python train_v2.py            # Generates local classification model
cd ../..
```

### 2. Environment Variables

Create `.env` in the root directory based on `.env.example`:

```ini
PORT=3000
DATABASE_URL=postgres://user:password@localhost:5432/deployguard
GITHUB_APP_ID=123456
GITHUB_CLIENT_ID=Iv1.your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_PRIVATE_KEY=base64_encoded_private_key
NLP_SERVICE_URL=http://localhost:8000
GROQ_API_KEY=gsk_your_groq_api_key
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000
```

Create `apps/web/.env`:
```ini
VITE_API_URL=http://localhost:3000
VITE_GITHUB_CLIENT_ID=Iv1.your_client_id
```

### 3. Run Development Servers

**Terminal 1 — Backend & Frontend:**
```bash
npm run dev
```

**Terminal 2 — NLP Microservice:**
```bash
cd apps/nlp
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

- **Dashboard:** `http://localhost:5173`
- **Server API:** `http://localhost:3000`
- **NLP Service:** `http://localhost:8000`
- **NLP Swagger Docs:** `http://localhost:8000/docs`

### 4. Running Tests

```bash
# Run backend test suite (unit + pipeline smoke tests)
npm test --workspace=@deployguard/server

# Build production frontend bundle
npm run build --workspace=@deployguard/web
```

---

## 🧪 Validation & Test Suite

DeployGuard includes automated tests covering all critical pipeline components:

- [`bundle.test.js`](file:///c:/Users/acer/Desktop/DATA/new%20project/apps/server/src/__tests__/bundle.test.js): Validates ZIP extraction, artifact retry backoff, multi-format normalization (Vite, Next.js, Webpack), and top-5 chunk delta calculations.
- [`pipeline.test.js`](file:///c:/Users/acer/Desktop/DATA/new%20project/apps/server/test/pipeline.test.js): End-to-end smoke test validating `pull_request.opened` → `workflow_run.completed` execution and webhook idempotency deduplication.
- [`queryCount.test.js`](file:///c:/Users/acer/Desktop/DATA/new%20project/apps/server/src/__tests__/queryCount.test.js): Validates active query delta computation and threshold evaluation.
- [`onboarding.test.js`](file:///c:/Users/acer/Desktop/DATA/new%20project/apps/server/src/__tests__/onboarding.test.js): Validates automatic build tool detection and YAML workflow generation.
- [`webhook.test.js`](file:///c:/Users/acer/Desktop/DATA/new%20project/apps/server/src/__tests__/webhook.test.js): Validates webhook event handling and database integration.

---

## 📝 Project Status Matrix

| Component / Feature | Milestone | Status |
|---------------------|-----------|:------:|
| Webhook Idempotency & Delivery Deduplication | Phase 0 | ✅ Complete |
| Artifact Download Retry with Exponential Backoff | Phase 0 | ✅ Complete |
| End-to-End Pipeline Smoke Test | Phase 0 | ✅ Complete |
| Automatic Build Tool Detection (`detect.js`) | Phase 1 | ✅ Complete |
| Automated Setup PR Generation (`deployguard/setup`) | Phase 1 | ✅ Complete |
| Dashboard Setup Status & Action Banners | Phase 1 | ✅ Complete |
| Multi-Bundler Support (Vite, Next.js, Webpack) | Phase 2 | ✅ Complete |
| Database `query_count` Metric Calculation | Phase 3 | ✅ Complete |
| Prisma / ORM Test Runner Contract | Phase 3 | ✅ Complete |
| NLP Classifier Retraining for Query Regressions | Phase 3 | ✅ Complete |
| Proactive Trend & Recurrence Warning Detection | Phase 4 | ✅ Complete |
| Visual Chunk Diff Breakdown (Recharts Bar Chart) | Phase 4 | ✅ Complete |
| Technical Dark Theme & Developer Token System | Phase 5 | ✅ Complete |
| Semantic Pass/Fail Left Indicator Stripes | Phase 5 | ✅ Complete |
| Expandable Check Rows with Cause Diagnostics | Phase 5 | ✅ Complete |
| Differentiated Strengths / Risks / Recommendations AI Cards | Phase 5 | ✅ Complete |
| Active Focal Point on Repository Directory | Phase 5 | ✅ Complete |

---

*Developed and maintained by [Saksham Hans](https://github.com/Saksham842).*
