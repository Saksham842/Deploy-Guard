# 🛡️ DeployGuard

> **GitHub App that baselines your app's performance on every deploy and blocks PRs that regress bundle size, query speed, or API latency — with an NLP layer that reads commit messages to explain the probable cause, not just the number.**

[![Node.js](https://img.shields.io/badge/Node.js-20-green)](https://nodejs.org)
[![Python](https://img.shields.io/badge/Python-3.11-blue)](https://python.org)
[![React](https://img.shields.io/badge/React-18-61dafb)](https://reactjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue)](https://postgresql.org)

---

## What it does

1. **Installs as a GitHub App** — subscribes to `pull_request` events
2. **Measures** bundle size, query count, and API latency per PR
3. **Compares** against a stored baseline for the target branch
4. **Posts a check run** (pass/fail) and a PR comment with a full breakdown
5. **Explains why** using an NLP classifier trained on 200 commit messages

---

## Architecture

```
GitHub PR → Webhook → Node.js server → Bull queue
                                    ↓
                              Worker picks up job
                                    ↓
                        ┌───────────────────────┐
                        │  analyseBundle()       │ ← CI artifact
                        │  diffPackageJson()     │ ← GitHub API
                        │  classifyCommits()     │ ← Python NLP
                        └───────────────────────┘
                                    ↓
                        Save to PostgreSQL
                                    ↓
                        Update GitHub check run
                        Post PR comment
```

---

## Quick Start (Local Dev)

### Prerequisites
- Node.js 20+, Python 3.11+, PostgreSQL, Redis
- A GitHub App (see setup below)
- [ngrok](https://ngrok.com) for local webhook testing

### 1. Clone & install

```bash
git clone https://github.com/yourname/deployguard.git
cd deployguard

# Root dependencies
npm install

# Server dependencies
cd apps/server && npm install

# Web dependencies
cd ../web && npm install

# Python NLP
cd ../nlp
pip install -r requirements.txt
python -m spacy download en_core_web_sm
python train.py   # trains the model — must run first!
```

### 2. Set up the database

```bash
psql $DATABASE_URL -f db/migrations/001_initial.sql
# Optionally seed with test data:
node apps/server/scripts/seed.js
```

### 3. Configure environment

```bash
cp .env.example .env
# Fill in all values — see .env.example for instructions
```

### 4. GitHub App setup

1. Go to **GitHub → Settings → Developer Settings → GitHub Apps → New**
2. Set **Webhook URL** to your ngrok URL: `https://xxxx.ngrok.io/api/github/webhooks`
3. Set permissions: Checks (R/W), Contents (R), Pull Requests (R/W), Metadata (R)
4. Subscribe to events: `pull_request`, `check_run`
5. Download the private key `.pem`, base64-encode it, paste into `.env`

### 5. Start everything

```bash
# Terminal 1 — Node server
cd apps/server && npm run dev

# Terminal 2 — Python NLP
cd apps/nlp && uvicorn main:app --reload --port 8000

# Terminal 3 — React dashboard
cd apps/web && npm run dev

# Terminal 4 — ngrok (for webhook testing)
ngrok http 3000
```

---

## Running Tests

```bash
cd apps/server && npm test
```

---

## Deployment

### Node server → Railway

```bash
# 1. Push to GitHub
# 2. Connect repo in Railway → add Postgres + Redis plugins
# 3. Set env vars in Railway dashboard
# 4. Railway auto-deploys from Dockerfile
```

### Python NLP → Render

```bash
# 1. New Web Service → connect GitHub repo
# 2. Root: apps/nlp | Build: pip install -r requirements.txt && python train.py
# 3. Start: uvicorn main:app --host 0.0.0.0 --port 8000
```

### Dashboard → Vercel

```bash
cd apps/web
npx vercel --prod
```

---

## Project Structure

```
deployguard/
├── apps/
│   ├── server/              # Node.js + Express
│   │   ├── src/
│   │   │   ├── webhook.js       # GitHub App handler
│   │   │   ├── comment.js       # PR comment builder
│   │   │   ├── db.js            # PostgreSQL layer
│   │   │   ├── analysers/       # bundle.js, packageDiff.js
│   │   │   ├── nlp/client.js    # HTTP → Python service
│   │   │   ├── routes/api.js    # REST API + OAuth
│   │   │   └── __tests__/       # Jest tests
│   │   └── scripts/seed.js
│   │
│   ├── nlp/                 # Python FastAPI
│   │   ├── main.py              # /classify endpoint
│   │   ├── train.py             # 200-example trainer
│   │   └── requirements.txt
│   │
│   └── web/                 # React + Vite
│       └── src/
│           ├── pages/           # Login, Dashboard, RepoDetail, Settings
│           └── components/      # Navbar, RepoCard, CheckRow, MetricChart, Badge
│
├── db/migrations/           # SQL schema
└── docs/                    # GitHub Actions snippet
```

---

## Interview Cheat Sheet

**Q: How does the NLP work?**
> Two layers: (1) deterministic — diff package.json between commits, new packages = 95% confidence. (2) scikit-learn LogisticRegression with TF-IDF on 200 labelled commit messages, threshold at 60% confidence. Chose a small interpretable model deliberately — in CI, explainability > accuracy.

**Q: How do baselines stay fresh?**
> Updated only when a PR merges to main AND passes the check — baseline always represents a clean passing state, commit SHA included for traceability.

**Q: How does GitHub App auth work?**
> JWT signed with private key → installation access token scoped per repo, auto-rotated by Octokit. Webhooks verified with HMAC-SHA256.
