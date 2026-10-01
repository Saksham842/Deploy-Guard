 # 🛡️ DeployGuard — Complete System Architecture & AI Analysis Specification

> **Target Audience:** AI models, automated analysis agents, and software architects reviewing, debugging, auditing, or extending the **DeployGuard** codebase.
>
> This document provides an exhaustive, authoritative breakdown of the entire DeployGuard repository: architecture, services, all REST endpoints, GitHub App webhooks, CI/CD pipeline, database schemas, 3-tier NLP/AI causation engine, frontend structure, edge cases, and extension points.

---

## 📑 Table of Contents

1. [System Overview & Value Proposition](#1-system-overview--value-proposition)
2. [Monorepo Structure & Service Boundaries](#2-monorepo-structure--service-boundaries)
3. [Decentralized Build Pattern & Pipeline Sequence](#3-decentralized-build-pattern--pipeline-sequence)
4. [GitHub App Webhook Architecture](#4-github-app-webhook-architecture)
5. [Complete REST API Specification](#5-complete-rest-api-specification)
   - [Backend Service (`apps/server`)](#51-backend-service-appsserver--express-port-3000)
   - [NLP Microservice (`apps/nlp`)](#52-nlp-microservice-appsnlp--fastapi-port-8000)
6. [NLP & AI Causation Engine (3-Tier Cascade)](#6-nlp--ai-causation-engine-3-tier-cascade)
7. [Database Schema & Data Model](#7-database-schema--data-model)
8. [Analyzer Engines & Metrics Calculation](#8-analyzer-engines--metrics-calculation)
9. [Frontend Application Architecture (`apps/web`)](#9-frontend-application-architecture-appsweb)
10. [CI/CD Integration & Tenant Onboarding Contract](#10-cicd-integration--tenant-onboarding-contract)
11. [Environment Configuration & Security Model](#11-environment-configuration--security-model)
12. [Resilience Patterns & Edge Cases Handled](#12-resilience-patterns--edge-cases-handled)
13. [AI Analysis Prompts & Evaluation Framework](#13-ai-analysis-prompts--evaluation-framework)

---

## 1. System Overview & Value Proposition

**DeployGuard** is an automated performance quality gate and AI-powered root-cause analysis platform for GitHub Pull Requests. It prevents silent performance regressions—such as frontend bundle bloat, database N+1 queries, and API latency spikes—from reaching production.

### Core Problems Solved
1. **Silent Production Degradation:** Large UI libraries or heavy dependencies are frequently merged without visibility into how they affect Core Web Vitals (LCP, FID/INP).
2. **Manual Build Profiling Friction:** Developers often lack the tooling or time to generate webpack/vite bundle reports on every pull request.
3. **Ambiguous Cause Identification:** When a build grows by 150 KB, developers struggle to determine which commit, package, or asset triggered the increase.
4. **Compute Cost & Security of CI:** Centralized SaaS building of arbitrary user repositories introduces severe security hazards (arbitrary code execution) and high compute costs. DeployGuard overcomes this using a **decentralized build model**.

---

## 2. Monorepo Structure & Service Boundaries

The project is structured as an npm workspaces monorepo with an integrated Python microservice:

```
Deploy-Guard/
├── .github/
│   └── workflows/
│       └── bundle-analysis.yml          # Dogfooding CI: builds DeployGuard's own frontend & emits stats
├── apps/
│   ├── server/                          # Node.js 20 + Express 4 + @octokit/app (Port 3000)
│   │   ├── index.js                     # Express app bootstrap, CORS, proxy trust, routing
│   │   ├── package.json
│   │   ├── Dockerfile
│   │   └── src/
│   │       ├── webhook.js               # GitHub App webhook hub & core pipeline coordinator
│   │       ├── comment.js               # Markdown table, causes, and PR comment generator
│   │       ├── db.js                    # PostgreSQL pool, queries, schema auto-migration
│   │       ├── analysers/
│   │       │   ├── bundle.js            # GitHub Actions artifact downloader (ZIP) & stats.json parser
│   │       │   └── packageDiff.js       # package.json diffing between baseSha and headSha via GitHub API
│   │       ├── nlp/
│   │       │   └── client.js            # Axios client communicating with the FastAPI NLP service
│   │       ├── routes/
│   │       │   └── api.js               # REST routes: /auth, /repos, /checks, /thresholds, /ai-review
│   │       └── utils/
│   │           └── groqExplain.js       # Dual-path AI client: NLP service -> Direct Groq LLM fallback
│   ├── nlp/                             # Python 3.11 + FastAPI + SentenceTransformers + Groq (Port 8000)
│   │   ├── main.py                      # FastAPI endpoints (/classify, /explain, /summarize, /review, /health)
│   │   ├── ai_features.py               # Prompts & orchestrators for regression explanations & health reviews
│   │   ├── groq_client.py               # Async HTTPX client for Groq Cloud API (llama-3.1-8b-instant)
│   │   ├── train_v2.py                  # Trains SentenceTransformer commit classifier -> model_v2.pkl
│   │   ├── train.py                     # Legacy TF-IDF v1 model trainer
│   │   ├── requirements.txt
│   │   └── Dockerfile                   # Production container for Render.com deployment
│   └── web/                             # React 18 + Vite + Tailwind CSS + Recharts (Port 5173)
│       ├── index.html
│       ├── vite.config.js
│       ├── scripts/
│       │   └── generate-stats.mjs       # Scans dist/assets directory and outputs stats.json
│       └── src/
│           ├── main.jsx / App.jsx       # App entry & React Router routes
│           ├── api.js                   # Client-side API fetch client with GitHub Bearer auth
│           ├── index.css                # Global CSS variables & styling tokens
│           ├── components/              # UI components (MetricChart, AIReviewCard, RepoCard, CheckRow, etc.)
│           └── pages/                   # Views (Dashboard, RepoDetail, Settings, Docs, Login, AuthCallback)
├── db/
│   └── migrations/
│       └── 001_initial.sql              # PostgreSQL reference schema (tables, foreign keys, indexes)
├── docs/
│   ├── onboarding.md                    # Universal GitHub Actions onboarding guide for tenants
│   ├── deployguard-action.yml           # Reusable GitHub Action specification
│   └── codementor-deployguard.yml       # Production-ready CI workflow template
├── render.yaml                          # Render.com Infrastructure-as-Code for NLP microservice
├── package.json                         # Monorepo root workspaces script runner
└── README.md                            # Comprehensive project overview
```

---

## 3. Decentralized Build Pattern & Pipeline Sequence

### Architecture Pattern
DeployGuard **never clones or compiles user code** on its servers. Instead:
1. The tenant repository's own GitHub Actions runner runs the application build.
2. An inline zero-dependency script records output asset sizes into `dist/stats.json`.
3. The runner uploads `dist/stats.json` as a GitHub Actions artifact named `bundle-stats`.
4. DeployGuard receives the `workflow_run.completed` webhook, securely downloads the artifact, computes metric deltas against stored baselines, invokes AI causation models, and writes the status back to GitHub.

### Sequence Flow Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Developer
    participant GH as GitHub Platform (Actions / PRs)
    participant Srv as DeployGuard Server (Express)
    participant DB as PostgreSQL Database
    participant NLP as DeployGuard NLP (FastAPI + Groq)

    Dev->>GH: Open / Synchronize PR
    GH->>Srv: Webhook: pull_request.opened
    Note over Srv: HMAC Signature Verified
    Srv->>DB: getOrCreateRepo()
    Srv->>GH: checks.create(status="in_progress", "⏳ Waiting for CI")
    
    GH->>GH: CI Workflow runs ("DeployGuard Bundle Stats")
    GH->>GH: actions/upload-artifact@v4 (name="bundle-stats")
    
    GH->>Srv: Webhook: workflow_run.completed (conclusion="success")
    Note over Srv: Matches PR via payload or Fallback REST API
    Srv->>GH: checks.create/update(status="in_progress", "🔍 Analysing bundle")
    Srv->>GH: Download artifact ZIP ("bundle-stats")
    Note over Srv: Parse stats.json (JSZip) -> totalKb
    Srv->>GH: pulls.getCommitList & diffPackageJson()
    Srv->>DB: getBaseline(repoId, baseBranch)
    Srv->>NLP: POST /classify (commits, added/removed pkgs)
    NLP-->>Srv: Return ranked causes (cause_type, confidence)
    
    Note over Srv: Compute deltas: ((after - before) / before) * 100
    Srv->>DB: saveCheck(repoId, prNumber, status, results, causes)
    
    alt If Check Failed
        Srv->>NLP: POST /explain (deltas, commits, pkgs, causes)
        NLP-->>Srv: Return Markdown explanation & fix suggestion
    else If Check Passed
        Srv->>NLP: POST /summarize (deltas, pkgs)
        NLP-->>Srv: Return positive status summary
        opt If baseBranch is main/master
            Srv->>DB: upsertBaseline(repoId, baseBranch, totalKb)
        end
    end

    Srv->>GH: checks.update(status="completed", conclusion="success"|"failure")
    Srv->>GH: issues.createComment(PR #, Markdown Report)
```

---

## 4. GitHub App Webhook Architecture

### Mount Point & Security
- **Path:** `POST /api/github/webhooks`
- **Handler:** `apps/server/src/webhook.js` mounted via `@octokit/app`'s `createNodeMiddleware`.
- **Security:** Every request must pass GitHub HMAC SHA-256 verification using `GITHUB_WEBHOOK_SECRET`.
- **Express Placement:** The webhook middleware is registered **before** `express.json()` because Octokit requires the raw unparsed request stream to verify the cryptographic signature.

### Event Subscriptions & Handlers

#### 1. `pull_request.opened` / `pull_request.synchronize` / `pull_request.reopened`
- **Function:** `handlePR({ octokit, payload })`
- **Action:**
  1. Extracts `owner`, `repoName`, `headSha`, `prNumber`, and `installation.id`.
  2. Ensures repository exists in DB via `getOrCreateRepo()`.
  3. Creates an immediate GitHub Check Run on `headSha` named `"DeployGuard"` with `status: "in_progress"` and title `"⏳ Waiting for Bundle Analysis CI…"`.

#### 2. `workflow_run.completed`
- **Function:** `handleWorkflowRun({ octokit, payload })`
- **Workflow Filter:** Listens strictly to workflows named `'Bundle Analysis'` or `'DeployGuard Bundle Stats'`.
- **Conclusion Check:** Skips runs if `workflow_run.conclusion !== 'success'`.
- **Fork PR Fallback:** For PRs submitted from external forks, GitHub omits `pull_requests[]` from the webhook payload for security. DeployGuard falls back to querying the GitHub REST API (`octokit.rest.pulls.list({ state: 'open' })`) and matching the head commit SHA.
- **Direct-Push Baseline Updates:** If no PR is associated and the push occurred directly on `main` or `master`, DeployGuard downloads the bundle stats and immediately updates the default branch baseline via `upsertBaseline()`.
- **Execution:** Calls `runAnalysis()` for each affected PR.

#### 3. `installation.created` / `installation_repositories.added`
- **Function:** `handleInstallation({ payload })`
- **Action:** Iterates over all granted repositories and inserts/updates records in the `repos` table with their `github_repo_id`, `owner`, `name`, and `installation_id`.

#### 4. Check Run & PR Comment Output
- Once analysis completes, `octokit.rest.checks.update()` updates the Check Run to `status: 'completed'` with `conclusion: 'success'` or `'failure'`.
- `octokit.rest.issues.createComment()` posts a detailed GitHub Flavored Markdown comment to the pull request detailing:
  - Metric comparison table (Before vs After vs Delta vs Pass/Fail status).
  - NLP-classified probable causes with confidence percentages.
  - Added / removed / upgraded dependencies.
  - Groq AI diagnostic analysis and copy-pasteable fix commands.

---

## 5. Complete REST API Specification

### 5.1 Backend Service (`apps/server` — Express, Port 3000)

All routes below (except `/health` and `/auth/*`) require standard token authentication:
`Authorization: Bearer <github_access_token>`.

---

#### `GET /health`
- **Description:** Liveness probe and service verification.
- **Auth:** None
- **Response:**
  ```json
  {
    "status": "ok",
    "service": "deployguard-server",
    "ts": "2026-09-26T18:50:00.000Z"
  }
  ```

---

#### `GET /api/auth/github`
- **Description:** Initiates GitHub OAuth flow by redirecting the browser to GitHub's authorization consent screen.
- **Auth:** None
- **Query Parameters Sent to GitHub:**
  - `client_id`: `process.env.GITHUB_CLIENT_ID`
  - `scope`: `read:user`
  - `redirect_uri`: `{BACKEND_URL}/api/auth/github/callback`

---

#### `GET /api/auth/github/callback`
- **Description:** OAuth redirect target. Exchanges temporary code for a GitHub access token, fetches the user profile, saves the user to PostgreSQL (`upsertUser`), and redirects the browser back to the frontend with credentials.
- **Query Parameters Received:** `code` (string)
- **Redirects To:**
  `{FRONTEND_URL}/auth/callback?token={access_token}&username={login}&avatar={avatar_url}`
- **Error Response (400/500):**
  ```json
  { "error": "OAuth exchange failed", "details": "..." }
  ```

---

#### `GET /api/repos`
- **Description:** Retrieves all repositories connected to DeployGuard, along with check counts and the most recent check status.
- **Auth:** `Bearer <github_token>` (validated against `https://api.github.com/user`)
- **Success Response (200 OK):**
  ```json
  [
    {
      "id": "e4b2d56a-1122-45e3-99b8-b80c3f0b4b21",
      "github_repo_id": "84729102",
      "owner": "Saksham842",
      "name": "Deploy-Guard",
      "install_id": "5928172",
      "threshold_config": {
        "bundle_kb": 10,
        "query_count": 20,
        "api_p95_ms": 200
      },
      "created_at": "2026-09-20T12:00:00.000Z",
      "check_count": 14,
      "last_check": {
        "id": "f12c8a77-4567-4a0b-93f1-2856f2a63201",
        "pr_number": 42,
        "status": "pass",
        "created_at": "2026-09-26T14:32:00.000Z"
      }
    }
  ]
  ```

---

#### `GET /api/repos/:owner/:name/checks`
- **Description:** Retrieves the recent check history (up to 30 runs) for a specific repository, including aggregated regression causes.
- **Auth:** `Bearer <github_token>`
- **URL Parameters:**
  - `owner`: Repository owner (e.g. `Saksham842`)
  - `name`: Repository name (e.g. `Deploy-Guard`)
- **Success Response (200 OK):**
  ```json
  {
    "repo": {
      "id": "e4b2d56a-1122-45e3-99b8-b80c3f0b4b21",
      "owner": "Saksham842",
      "name": "Deploy-Guard"
    },
    "checks": [
      {
        "id": "f12c8a77-4567-4a0b-93f1-2856f2a63201",
        "repo_id": "e4b2d56a-1122-45e3-99b8-b80c3f0b4b21",
        "pr_number": 42,
        "head_sha": "a1b2c3d4e5f67890",
        "base_sha": "f0e1d2c3b4a59687",
        "status": "fail",
        "results": {
          "bundle_kb": {
            "before": 210,
            "after": 245,
            "delta": 16.67
          },
          "query_count": {
            "before": 12,
            "after": null,
            "delta": 0
          }
        },
        "created_at": "2026-09-26T14:32:00.000Z",
        "causes": [
          {
            "id": "c98b21ef-9921-42cb-b124-783321556012",
            "check_id": "f12c8a77-4567-4a0b-93f1-2856f2a63201",
            "cause_type": "new_dependency",
            "detail": "Added packages: lottie-web, lodash",
            "confidence": 0.95,
            "created_at": "2026-09-26T14:32:05.000Z"
          }
        ]
      }
    ]
  }
  ```

---

#### `GET /api/repos/:owner/:name/thresholds`
- **Description:** Returns the current percentage/absolute threshold limits for a repository.
- **Auth:** `Bearer <github_token>`
- **Success Response (200 OK):**
  ```json
  {
    "bundle_kb": 10,
    "query_count": 20,
    "api_p95_ms": 200
  }
  ```

---

#### `PUT /api/repos/:owner/:name/thresholds`
- **Description:** Updates the threshold limits applied during PR metric evaluation.
- **Auth:** `Bearer <github_token>`
- **Request Body:**
  ```json
  {
    "bundle_kb": 5,
    "query_count": 15,
    "api_p95_ms": 150
  }
  ```
- **Success Response (200 OK):** Returns the updated `threshold_config` object.

---

#### `GET /api/repos/:owner/:name/ai-review`
- **Description:** Aggregates repository check metrics (total checks, pass/fail ratio, average bundle size, worst regression, and common causes), and requests a comprehensive AI project health evaluation from the NLP microservice.
- **Auth:** `Bearer <github_token>`
- **Success Response (200 OK):**
  ```json
  {
    "report": "### ✅ Strengths\n- Healthy 85% pass rate across the last 20 checks...\n\n### ⚠️ Risks\n- Single worst regression spiked bundle by 45 KB...\n\n### 🔧 Recommendations\n- Introduce dynamic imports for charting libraries..."
  }
  ```

---

### 5.2 NLP Microservice (`apps/nlp` — FastAPI, Port 8000)

FastAPI automatic OpenAPI documentation is accessible at `http://localhost:8000/docs`.

---

#### `GET /health`
- **Description:** Health probe reporting loaded model version, number of training samples, and Groq connectivity.
- **Response:**
  ```json
  {
    "status": "ok",
    "service": "deployguard-nlp",
    "model_version": "v2-sentence-transformers",
    "model_loaded": true,
    "classes": [
      "bundle_size", "query_regression", "latency_spike", "dependency_bloat",
      "new_dependency", "asset_added", "feature", "refactor", "chore", "unknown"
    ],
    "n_training_samples": 450,
    "cv_f1_macro": 0.942,
    "groq_enabled": true,
    "groq_model": "llama-3.1-8b-instant"
  }
  ```

---

#### `POST /classify`
- **Description:** Main classification endpoint. Accepts commit messages and package diffs, injects rule-based causes for package changes, runs semantic classification on commits, deduplicates classes, and returns the top 5 causes sorted by confidence.
- **Request Body (`CommitRequest`):**
  ```json
  {
    "messages": [
      "feat: add lottie animation viewer component",
      "chore: update dependencies in lockfile"
    ],
    "new_packages": ["lottie-web"],
    "removed_packages": []
  }
  ```
- **Response (`List[Cause]`):**
  ```json
  [
    {
      "cause_type": "new_dependency",
      "detail": "Added packages: lottie-web",
      "confidence": 0.95,
      "all_scores": { "new_dependency": 0.95 },
      "model_version": "rule-based",
      "via_groq": false
    },
    {
      "cause_type": "bundle_size",
      "detail": "Commit: \"feat: add lottie animation viewer component\"",
      "confidence": 0.887,
      "all_scores": {
        "bundle_size": 0.887,
        "feature": 0.082,
        "asset_added": 0.031
      },
      "model_version": "v2-sentence-transformers",
      "via_groq": false
    }
  ]
  ```

---

#### `POST /classify/single`
- **Description:** Classifies a single commit message and returns confidence scores across all 10 supported classes.
- **Request Body:** `{ "message": "refactor db queries to use bulk fetch" }`
- **Response:** Returns a single `Cause` object.

---

#### `POST /classify/batch`
- **Description:** Independent evaluation of an array of commit messages without deduplication.
- **Request Body:** `{ "messages": ["commit 1", "commit 2"] }`
- **Response:** List of individual classification results with message details.

---

#### `POST /explain`
- **Description:** Generates an AI explanation for a failing PR using Groq LLaMA 3.1. Explains WHAT happened, WHY it happened, and provides an actionable copy-pasteable code or command fix.
- **Request Body (`ExplainRequest`):**
  ```json
  {
    "bundle_delta_kb": 42.5,
    "bundle_delta_pct": 18.2,
    "added_packages": ["lottie-web"],
    "removed_packages": [],
    "commit_messages": ["feat: add lottie animation viewer component"],
    "nlp_cause": "bundle_size"
  }
  ```
- **Response:**
  ```json
  {
    "explanation": "### What Happened\nYour bundle increased by **42.5 KB (+18.2%)**, exceeding the ±10% threshold.\n\n### Why It Happened\nAdding `lottie-web` imports the full JSON parsing and Canvas rendering runtime.\n\n### How To Fix It\nUse dynamic imports or switch to `lottie-web/build/player/lottie_light`:\n```js\nconst lottie = await import('lottie-web/build/player/lottie_light');\n```"
  }
  ```

---

#### `POST /summarize`
- **Description:** Generates a concise, encouraging 2-3 bullet summary when all PR metrics are healthy.
- **Request Body (`ExplainRequest`):**
  ```json
  {
    "bundle_delta_kb": -4.2,
    "bundle_delta_pct": -1.8,
    "added_packages": [],
    "removed_packages": [],
    "commit_messages": ["refactor: tree-shake lodash utilities"]
  }
  ```
- **Response:**
  ```json
  {
    "summary": "### ✅ All Checks Passed\n- Bundle size decreased by **4.2 KB (-1.8%)**.\n- No unexpected package bloat detected."
  }
  ```

---

#### `POST /review`
- **Description:** Generates a project-level health audit categorized strictly into **Strengths**, **Risks**, and **Recommendations**.
- **Request Body (`ReviewRequest`):**
  ```json
  {
    "repo_name": "Deploy-Guard",
    "total_checks": 25,
    "passed_checks": 21,
    "failed_checks": 4,
    "avg_bundle_kb": 220.4,
    "worst_regression_kb": 52.0,
    "most_common_cause": "new_dependency",
    "recent_packages_added": ["recharts", "lucide-react"]
  }
  ```
- **Response:**
  ```json
  {
    "report": "### ✅ Strengths\n- Strong 84% pass rate over 25 checks...\n\n### ⚠️ Risks\n- Maximum recorded regression reached 52.0 KB...\n\n### 🔧 Recommendations\n- Configure bundle chunk splitting in `vite.config.js`..."
  }
  ```

---

## 6. NLP & AI Causation Engine (3-Tier Cascade)

To maintain ultra-low latency, zero compute costs, and high precision, DeployGuard routes all commit text through a 3-tier cascade:

```
[ Commit Message ]
       │
       ▼
┌────────────────────────────────────────────────────────┐
│ Tier 1: Local SentenceTransformer (all-MiniLM-L6-v2)   │
│ Embeddings: 384 dimensions                             │
│ Classifier: LogisticRegression / SGDClassifier        │
│ Latency: <50 ms | Cost: $0                             │
└────────────────────────────────────────────────────────┘
       │
       ├─► If Confidence >= 0.55 ──► ACCEPT PREDICTION
       │
       ▼ (If Confidence < 0.55)
┌────────────────────────────────────────────────────────┐
│ Tier 2: Groq Cloud API (llama-3.1-8b-instant)          │
│ System prompt: Zero-shot JSON classifier               │
│ Latency: ~200 ms | Cost: Minimal ($0 on free tier)    │
└────────────────────────────────────────────────────────┘
       │
       ├─► If Groq Success ──► ACCEPT PREDICTION
       │
       ▼ (If Groq offline or rate limited)
┌────────────────────────────────────────────────────────┐
│ Tier 3: Graceful Degradation                           │
│ Falls back to best Tier 1 guess or rule-based diff    │
│ Latency: <1 ms | Never blocks PR build                 │
└────────────────────────────────────────────────────────┘
```

### The 10 Classification Categories
1. `bundle_size`: Heavy UI components, visualization libraries, or client-side packages.
2. `query_regression`: N+1 query patterns, missing DB indexes, unbounded SELECT statements.
3. `latency_spike`: Blocking I/O, synchronous computations in request path, missing timeouts.
4. `dependency_bloat`: Lockfile churn, transitive dependencies, unoptimized version bumps.
5. `new_dependency`: First-time installation of an npm/pip dependency.
6. `asset_added`: Media files, large SVG bundles, font files committed to repository.
7. `feature`: Brand new application business logic.
8. `refactor`: Structural code cleanup without intended functional alteration.
9. `chore`: Documentation, tooling config, formatting, CI scripts.
10. `unknown`: Ambiguous or single-word commits (e.g., `fix`, `wip`, `update`).

### Server-Side Dual-Path Groq Fallback (`groqExplain.js`)
If the FastAPI microservice on Render is cold-starting, the Express server in `apps/server/src/utils/groqExplain.js` directly invokes Groq's API via Axios with identical prompt constraints. If both fail, it returns `null` so the GitHub Check Run completes cleanly without hanging.

---

## 7. Database Schema & Data Model

PostgreSQL 15+ is used for persistence. The database is initialized and managed automatically at server startup via `CREATE TABLE IF NOT EXISTS` queries in `apps/server/src/db.js`.

### Entity-Relationship Diagram

```mermaid
erDiagram
    users {
        uuid id PK
        bigint github_user_id UK
        text username
        text avatar_url
        text access_token
        timestamptz created_at
    }

    repos {
        uuid id PK
        bigint github_repo_id UK
        text owner
        text name
        bigint install_id
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

    repos ||--o{ baselines : "tracks baselines for"
    repos ||--o{ checks : "records checks for"
    checks ||--o{ regression_causes : "has causes"
```

### Table Definitions & Constraints

#### `repos`
- `id` (UUID PK, default `uuid_generate_v4()`)
- `github_repo_id` (BIGINT UNIQUE NOT NULL)
- `owner` (TEXT NOT NULL)
- `name` (TEXT NOT NULL)
- `install_id` (BIGINT NOT NULL)
- `threshold_config` (JSONB NOT NULL DEFAULT `'{"bundle_kb":10,"query_count":20,"api_p95_ms":200}'`)
- `created_at` (TIMESTAMPTZ DEFAULT NOW())

#### `baselines`
- `id` (UUID PK)
- `repo_id` (UUID FK -> `repos.id` ON DELETE CASCADE)
- `branch` (TEXT NOT NULL, e.g. `'main'`, `'master'`)
- `metric` (TEXT NOT NULL, e.g. `'bundle_kb'`, `'query_count'`, `'api_p95_ms'`)
- `value` (NUMERIC NOT NULL)
- `commit_sha` (TEXT NOT NULL)
- `recorded_at` (TIMESTAMPTZ DEFAULT NOW())
- **Constraint:** `UNIQUE(repo_id, branch, metric)`

#### `checks`
- `id` (UUID PK)
- `repo_id` (UUID FK -> `repos.id` ON DELETE CASCADE)
- `pr_number` (INT NOT NULL)
- `head_sha` (TEXT NOT NULL)
- `base_sha` (TEXT NOT NULL)
- `status` (TEXT NOT NULL DEFAULT `'pending'`, values: `'pending'`, `'pass'`, `'fail'`)
- `results` (JSONB, format: `{ "<metric>": { "before": N, "after": N, "delta": N } }`)
- `created_at` (TIMESTAMPTZ DEFAULT NOW())

#### `regression_causes`
- `id` (UUID PK)
- `check_id` (UUID FK -> `checks.id` ON DELETE CASCADE)
- `cause_type` (TEXT NOT NULL)
- `detail` (TEXT)
- `confidence` (NUMERIC)
- `created_at` (TIMESTAMPTZ DEFAULT NOW())

#### `users`
- `id` (UUID PK)
- `github_user_id` (BIGINT UNIQUE NOT NULL)
- `username` (TEXT NOT NULL)
- `avatar_url` (TEXT)
- `access_token` (TEXT)
- `created_at` (TIMESTAMPTZ DEFAULT NOW())

#### Indexes
- `idx_baselines_repo_branch` on `baselines(repo_id, branch)`
- `idx_checks_repo_pr` on `checks(repo_id, pr_number)`
- `idx_checks_repo_created` on `checks(repo_id, created_at DESC)`
- `idx_causes_check` on `regression_causes(check_id)`

---

## 8. Analyzer Engines & Metrics Calculation

### 8.1 Bundle Size Analyzer (`bundle.js`)
- **Artifact Retrieval:** Queries GitHub Actions API for completed runs for the target commit SHA, searches for an artifact named `'bundle-stats'`, and downloads the binary payload.
- **Archive Extraction:** Uses `jszip` to extract `stats.json` from the ZIP archive (or parses raw JSON if uncompressed).
- **Format Normalization:** Aggregates `assets` or `chunks` byte sizes, calculates total KB (`Math.round(totalBytes / 1024)`), sorts chunks descending by size, and extracts the top 20 individual chunks for granular inspection.

### 8.2 Dependency Diff Analyzer (`packageDiff.js`)
- Fetches `package.json` at `baseSha` and `headSha` via GitHub API.
- Checks monorepo paths (`apps/web/package.json`) followed by root (`package.json`).
- Flattens `dependencies` and `devDependencies`.
- Identifies:
  - `added`: Package names present in `head` but absent in `base`.
  - `removed`: Package names present in `base` but absent in `head`.
  - `upgraded`: Packages with altered version strings (`{ name, from, to }`).

### 8.3 Metric Evaluation Formula
For metric value $M_{after}$ and baseline value $M_{before}$:
$$\Delta = \begin{cases} \frac{M_{after} - M_{before}}{M_{before}} \times 100 & \text{if } M_{before} \neq \text{null} \\ 0 & \text{if } M_{before} = \text{null} \end{cases}$$

**Pass Condition:**
$$|\Delta| \le \text{Threshold}$$
*(If $M_{before}$ is null, the check passes by default as a baseline-establishing first run).*

---

## 9. Frontend Application Architecture (`apps/web`)

### Tech Stack
- **Framework:** React 18 with Vite
- **Styling:** Tailwind CSS + Vanilla CSS custom variables (`index.css`)
- **Visuals:** Canvas2D particle background animation (`ParticleBackground.jsx`)
- **Charting:** Recharts line and bar graphs (`MetricChart.jsx`)
- **Routing:** `react-router-dom`

### Page Views & Hierarchy
1. **`/login` (`Login.jsx`):** Landing page showcasing product features, stats summary, and "Sign in with GitHub" OAuth CTA.
2. **`/auth/callback` (`AuthCallback.jsx`):** Extracts `token`, `username`, and `avatar` from OAuth redirect query parameters, stores them in `localStorage` (`dg_token`), and redirects to `/dashboard`.
3. **`/dashboard` (`Dashboard.jsx`):** Primary repository directory showing connected repositories, health cards, last check states, pass rates, and an interactive "+ Add Repository" modal.
4. **`/repo/:owner/:name` (`RepoDetail.jsx`):** Deep inspection page for a single repository. Includes:
   - Historical bundle size trendline (Recharts).
   - Historical check log table with expand/collapse details.
   - Live AI Health Review card with on-demand refresh.
   - Threshold sliders for live limit adjustments.
5. **`/settings` (`Settings.jsx`):** Global threshold settings and notifications.
6. **`/docs` (`Docs.jsx`):** In-app documentation and copy-pasteable CI workflow generators.

---

## 10. CI/CD Integration & Tenant Onboarding Contract

To connect any frontend application to DeployGuard, the tenant repository only needs to commit a single GitHub Actions workflow file: `.github/workflows/deployguard.yml`.

### Tenant Workflow Template
```yaml
name: DeployGuard Bundle Stats

on:
  pull_request:
    branches: ['**']
  push:
    branches: [main, master]

permissions:
  contents: read
  actions: write

jobs:
  bundle-stats:
    runs-on: ubuntu-latest
    name: Upload bundle stats for DeployGuard

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install & Build
        run: |
          npm install
          npm run build

      - name: Generate bundle stats
        run: |
          node -e "
            const fs = require('fs');
            const path = require('path');
            const distDir = 'dist/assets';
            const files = fs.existsSync(distDir) ? fs.readdirSync(distDir) : [];
            const assets = files.map(f => ({
              name: f,
              size: fs.statSync(path.join(distDir, f)).size
            }));
            fs.writeFileSync('dist/stats.json', JSON.stringify({ assets }));
          "

      - name: Upload bundle stats artifact
        uses: actions/upload-artifact@v4
        with:
          name: bundle-stats
          path: dist/stats.json
          retention-days: 7
```

---

## 11. Environment Configuration & Security Model

### Required Environment Variables

```bash
# ── GitHub App Credentials ─────────────────────────────────────────────────────
GITHUB_APP_ID=123456
GITHUB_WEBHOOK_SECRET=your_32_byte_hex_secret
# Base64-encoded RSA .pem private key (avoids newline truncation on cloud hosts)
GITHUB_PRIVATE_KEY=LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQ...
GITHUB_CLIENT_ID=Iv1.your_oauth_client_id
GITHUB_CLIENT_SECRET=your_oauth_client_secret

# ── Database ───────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@hostname:5432/deployguard

# ── NLP Microservice ───────────────────────────────────────────────────────────
NLP_SERVICE_URL=http://localhost:8000

# ── Groq LLM API ───────────────────────────────────────────────────────────────
GROQ_API_KEY=gsk_your_groq_api_key_here

# ── Host & Network ─────────────────────────────────────────────────────────────
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://deploy-guard-web.vercel.app
BACKEND_URL=https://deploy-guard-server.onrender.com
DASHBOARD_URL=https://deploy-guard-web.vercel.app
```

### Security Measures
- **HMAC Verification:** Rejects any unauthorized payload hitting `/api/github/webhooks`.
- **Zero Code Ingestion:** Tenant source code stays inside their own GitHub runner.
- **Token Scrubbing:** Access tokens are transmitted over TLS and validated against GitHub's `/user` endpoint.
- **Base64 PEM Storage:** Prevents key corruption from shell linebreaks or escape character differences between Windows and Linux.

---

## 12. Resilience Patterns & Edge Cases Handled

| Edge Case | Solution Implemented in Code |
|-----------|------------------------------|
| **Fork PRs omit `pull_requests[]`** | `handleWorkflowRun` falls back to `octokit.rest.pulls.list` and filters open PRs by `head.sha`. |
| **Direct Pushes to `main`/`master`** | If no open PR matches the completed run, DeployGuard checks if `head_branch` is default and updates the baseline directly, preventing subsequent PRs from failing due to missing reference baselines. |
| **New Branch with Missing Baseline** | If a target branch has no recorded baseline, `runAnalysis` checks if `baseBranch` is not `main`/`master` and automatically substitutes the baseline of `main` or `master`. |
| **NLP Microservice Cold Start** | `groqExplain.js` in Node.js contains a 18-second timeout for the Python service, immediately falling back to a direct call to Groq Cloud API. |
| **Groq API Rate Limits or Outage** | If Groq returns 429 or fails, the pipeline degrades gracefully to the local ML model's best guess or rule-based diff, never blocking the GitHub Check Run. |
| **Empty or Missing CI Artifacts** | If a tenant repo has not uploaded `bundle-stats`, `analyseBundle` returns `{ totalKb: null }`. The PR comment displays an informative notice explaining how to configure the upload step. |
| **Subdirectory / Monorepo Support** | `packageDiff.js` scans both `apps/web/package.json` and root `package.json` to detect package changes regardless of repository structure. |

---

## 13. AI Analysis Prompts & Evaluation Framework

When using an AI model to evaluate, critique, or extend DeployGuard, the following prompts and evaluation criteria should be applied:

### System Prompt for External AI Agents
```markdown
You are an expert full-stack systems architect, security auditor, and performance engineer analyzing the DeployGuard codebase.

When assessing this project, focus on:
1. Webhook reliability and idempotency (ensuring duplicate events don't duplicate database checks).
2. Accuracy and precision of the 3-tier NLP causation classifier.
3. Resilience of the GitHub Actions artifact downloading and parsing logic.
4. Database query efficiency, index utilization, and transaction boundaries.
5. Extensibility towards additional performance metrics (Lighthouse CI, database query counting, and API p95 latency benchmarks).
```

### Key Areas for AI-Driven Code Review
1. **Idempotency in `webhook.js`:** Ensure that duplicate `workflow_run.completed` events for the same check run do not post duplicate PR comments.
2. **Batching Database Inserts:** Evaluate whether `saveCheck()` and `regression_causes` insertions can use bulk `UNNEST` or single-statement multi-row inserts for large commit histories.
3. **Expanded Bundler Support:** Extend `bundle.js` to parse Webpack `stats.json`, Next.js `.next/build-manifest.json`, and Vite `manifest.json`.
4. **Active Metric Expansion:** Implement live test harness consumers for the `query_count` and `api_p95_ms` columns currently stubbed in `computeMetrics()`.

---
*DeployGuard Architectural Specification — Maintained for AI Agents & Engineering Teams.*
