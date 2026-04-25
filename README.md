# 🛡️ DeployGuard

> **DeployGuard is a full-stack GitHub App that baselines your application's performance on every deploy. It blocks Pull Requests that regress bundle size, query speed, or API latency—and uses an NLP Causation Engine to explain exactly *why* the regression happened based on commit messages and package diffs.**

[![Node.js](https://img.shields.io/badge/Node.js-20-green)](https://nodejs.org)
[![Python](https://img.shields.io/badge/Python-3.11-blue)](https://python.org)
[![React](https://img.shields.io/badge/React-18-61dafb)](https://reactjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue)](https://postgresql.org)
[![Vercel](https://img.shields.io/badge/Deployed-Vercel-black)](https://vercel.com)
[![Railway](https://img.shields.io/badge/Backend-Railway-black)](https://railway.app)

---

##  Key Features

1. **GitHub App Integration** — Installs seamlessly and subscribes to `pull_request` events to run automated audits.
2. **Performance Baselines** — Automatically measures bundle size, query counts, and API latency. Updates the permanent baseline *only* when a PR successfully merges into `main`.
3. **Automated Checks & Comments** — Posts a native GitHub Check Run (pass/fail) and injects a detailed PR comment with a breakdown of performance deltas.
4. **NLP Root Cause Analysis** — Uses a Python FastAPI microservice with a custom scikit-learn NLP model trained on 200+ developer commit messages to probabilistically identify the *cause* of the regression.
5. **Modern Dashboard** — A sleek, dark-mode React (Vite) dashboard built with custom glassmorphism components to view real-time repository stats.

---

##  Architecture & Data Flow

DeployGuard is designed as a distributed, event-driven microservices architecture.

```text
GitHub PR Event → Express.js Webhook → PostgreSQL (Prisma/pg)
                                     ↓
                         ┌───────────────────────┐
                         │  analyseBundle()       │ ← CI Artifact Parsing
                         │  diffPackageJson()     │ ← GitHub API REST Fetch
                         │  classifyCommits()     │ ← Python FastAPI NLP
                         └───────────────────────┘
                                     ↓
                         Save Metrics to PostgreSQL
                                     ↓
                         Update GitHub Check Run
                         Post Automated PR Comment
```

---

##  Deployment Strategy

The application is deployed across three distinct cloud providers for optimal performance and cost-efficiency:

- **Frontend (Vercel):** React + Vite SPA, utilizing Vercel's Edge Network for instant load times. Protected by OAuth GitHub login.
- **Backend (Railway):** Node.js Express server running the core webhook handlers, Octokit integrations, and automatic PostgreSQL schema migrations.
- **NLP Engine (Render):** Python FastAPI service running the `scikit-learn` LogisticRegression model to analyze package diffs and commit messages.

---

##  Tech Stack Deep Dive

### Frontend
- **React 18 + Vite:** Lightning-fast HMR and optimized production builds.
- **Vanilla CSS + CSS Variables:** Fully custom design system, zero generic UI libraries. Implements modern UI trends (glassmorphism, micro-animations, vibrant gradients).
- **React Router:** Protected routing with GitHub OAuth integration.

### Backend
- **Node.js + Express:** Robust REST API and Webhook receiver.
- **@octokit/app & @octokit/rest:** Complete GitHub App integration, handling JWT generation, installation access tokens, and check-run management.
- **PostgreSQL:** Relational database for storing repositories, users, performance baselines, and individual check runs.

### Data Science / NLP
- **Python + FastAPI:** High-performance API for the causation engine.
- **scikit-learn:** TF-IDF Vectorization and LogisticRegression. Chosen deliberately over LLMs for **predictability, speed, and 100% deterministic explainability** in a CI/CD environment.

---

##  Quick Start (Local Development)

### Prerequisites
- Node.js 20+, Python 3.11+, PostgreSQL
- A configured GitHub App
- [ngrok](https://ngrok.com) for localhost webhook routing

### 1. Installation

```bash
git clone https://github.com/Saksham842/Deploy-Guard.git
cd Deploy-Guard

# Install Server dependencies
cd apps/server && npm install

# Install Web dependencies
cd ../web && npm install

# Train & Start Python NLP
cd ../nlp
pip install -r requirements.txt
python train.py   # Must run first to build model.pkl
uvicorn main:app --reload --port 8000
```

### 2. Environment Variables
Create `.env` files in both `apps/server` and `apps/web` referencing the `.env.example`.

### 3. Start Services
```bash
# Terminal 1 — Node server
cd apps/server && npm run dev

# Terminal 2 — React dashboard
cd apps/web && npm run dev

# Terminal 3 — ngrok (for webhooks)
ngrok http 3000
```

---

##  Core Engineering Decisions

### 1. Deterministic NLP over Generative LLMs
While it is tempting to pass commit messages to GPT-4 to explain regressions, DeployGuard uses a custom `scikit-learn` LogisticRegression model trained on TF-IDF word vectors from 200+ developer commit messages. 
- **Latency:** CI/CD feedback must be instant. Calling an external LLM introduces unacceptable latency and potential rate-limiting.
- **Explainability:** In a deployment pipeline, predictability is paramount. A smaller, deterministic model allows the system to definitively explain *why* a specific confidence score was assigned based on transparent feature weights, building trust with the developers using the tool.

### 2. Zero-Trust GitHub Authentication
To ensure absolute security when accessing user repositories, the backend is built as a fully compliant GitHub App rather than relying on static personal access tokens.
- The Node.js server signs a short-lived JWT using an RSA private key.
- It exchanges this JWT for a temporary Installation Access Token scoped *strictly* to the specific repository triggering the webhook.
- Incoming webhooks are cryptographically verified using HMAC-SHA256 signatures to prevent spoofing.

### 3. Strict Baseline Integrity
Performance baselines are useless if they are corrupted by failing code. DeployGuard enforces a strict state machine for performance metrics:
- Baselines are evaluated on every Pull Request, but they are *only* updated when a PR is successfully merged into the `main` or `master` branch **and** the performance check passes. 
- This ensures the baseline is always anchored to a clean, production-ready state, preventing gradual performance degradation (the "boiling frog" problem).

