# 🛡️ DeployGuard

> **Automated performance quality gates & AI-powered regression analysis for Pull Requests.**
> 
> DeployGuard is a full-stack, enterprise-ready GitHub App that stops performance regressions (bundle size bloat, DB query regressions, and API latency spikes) *before* they hit production. It posts native GitHub Check Runs and markdown analysis comments directly on PRs, complete with NLP-powered root-cause classification and Groq-powered AI explanations.

---

## 🚀 Why This Project Matters (The Core Problem)

In modern software engineering, performance regressions usually slip into production silently. A developer adds a heavy library or writes an unoptimized database query, and it goes unnoticed until users experience lag or cloud hosting costs spike.

DeployGuard solves this by **shifting performance metrics left** (directly into the Pull Request loop):
* **Protects Core Web Vitals:** Blocks bundle size regressions to maintain fast page load times and search rankings.
* **Reduces Server/DB Costs:** Flags query regressions to protect database resources from unoptimized loops.
* **Saves Developer Time:** Instead of manually hunting down *why* a build bloated, DeployGuard automatically classifies the cause (e.g. upgraded package, asset additions) and provides a copy-pasteable fix command.

---

## 🏗️ Architectural Overview

```
[ Developer PR ] ────▶ [ GitHub Actions Runner ] ────▶ [ DeployGuard Webhook ]
                             (Builds & Measures)             (NLP Analysis & AI Review)
                                     │                                  │
                                     ▼                                  ▼
                            (Uploads bundle-stats)           (Posts PR Checks & Comments)
```

DeployGuard consists of three core components:
1. **Express.js Backend (`apps/server`):** Listens to GitHub webhook events, verifies cryptographic signatures, handles GitHub OAuth authentication, and orchestrates database transactions.
2. **FastAPI NLP Service (`apps/nlp`):** Runs the local ML classification models and manages the Groq LLM pipelines.
3. **React Dashboard (`apps/web`):** A sleek, premium dashboard featuring charts, real-time repository statistics, and structured AI-generated health reports.

---

## 💡 Key Engineering Decisions & Trade-Offs

### 1. Decentralized Build Pattern (Security & Scale)
* **Decision:** We offload the compilation (`npm run build`) to the user's own **GitHub Actions runner** and have it upload a metadata `stats.json` file. DeployGuard simply downloads this JSON metadata.
* **Why:** Running `npm install` and compiling arbitrary code on our own servers would open us up to **Remote Code Execution (RCE)** vulnerabilities and consume massive compute resources. By decentralizing the build, we guarantee 100% server isolation and zero compute costs for compilation.

### 2. 3-Tier Hybrid NLP Engine (Latency & Cost Optimization)
* **Decision:** Classification of commits is processed via a cascaded 3-tier pipeline:
  1. **Tier 1 (Local Model):** Matches commit messages against semantic sentence embeddings (`all-MiniLM-L6-v2`) + Logistic Regression ($<50$ms latency, zero cost).
  2. **Tier 2 (Groq LLM Fallback):** If local confidence is $<0.55$, it escalates the commit message to `llama-3.1-8b-instant` via the Groq API ($~200$ms latency).
  3. **Tier 3 (Graceful Fallback):** If the LLM rate-limits or is offline, it returns the top local prediction flagged as `low_confidence`.
* **Why:** Running every commit through a commercial LLM would be slow and expensive. This hybrid model achieves near-instant response times for standard commits while utilizing the reasoning power of an LLM only when necessary.

### 3. Strict Database Baseline Integrity
* **Decision:** Baselines for comparison (e.g., "what was the previous bundle size?") are updated **only** when a PR merges into the `main` branch **and** passes all checks.
* **Why:** This prevents **"baseline drift"**—if an unoptimized PR with a bundle size regression is merged, and it updates the baseline, the new larger size becomes the "new normal." By restricting updates to passing merges, we enforce a strict quality floor.

---

## 🛠️ Key Technical Challenges Solved (My Contributions)

During development and testing, I identified and resolved several critical system bugs:

* **Cross-Fork PR Security Handling:** Fixed a bug where external contributor PRs (originating from forks) failed because GitHub restricts the payload `workflow_run.pull_requests` for security. Added a robust API callback fallback that queries open pulls on the target head SHA.
* **Asset-Filtering Compilation Engine:** Rewrote the stats scanning script to filter out static image/font assets, ensuring that changes to non-code files do not trigger false bundle size alerts.
* **Cross-Platform Path Compatibility:** Fixed Windows/Linux filepath mismatches in Node scripts by replacing manual pathname string regexes with standard, URL-decoded path resolution (`fileURLToPath`).
* **CSS Transform Positioning Fix:** Resolved an issue where the React onboarding modal was pushed to the bottom of the screen. Solved this by restructuring the React DOM hierarchy, rendering the fixed modal outside the parent `transform` container which was overriding the browser viewport layout.

---

## 🚀 Getting Started (Local Development)

### Prerequisites
* Node.js 20+
* Python 3.11+
* PostgreSQL 15+ (Local or Neon)
* A [GitHub App registration](https://docs.github.com/en/apps) with Webhook + Checks permissions.

### 1. Installation
```bash
# Clone the repository
git clone https://github.com/Saksham842/Deploy-Guard.git
cd Deploy-Guard

# Install root, server, and web dependencies (npm workspaces)
npm install

# Setup python environment and train the NLP models
cd apps/nlp
python -m venv venv
# Activate virtualenv and install packages
source venv/bin/activate  # Or .\venv\Scripts\activate on Windows
pip install -r requirements.txt
python train_v2.py
```

### 2. Configure Environment
Create a `.env` file at the root of the project:
```bash
cp .env.example .env
```
Provide your database connection strings, GitHub App credentials, and base64-encoded private key PEM file.

### 3. Start Development Servers
Run the backend and dashboard concurrently:
```bash
# In the root workspace:
npm run dev
```
Start the NLP FastAPI microservice:
```bash
# In apps/nlp:
uvicorn main:app --reload --port 8000
```

---

## 🔌 API Documentation

### NLP Microservice (`apps/nlp` — FastAPI)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/classify` | Evaluates commit message categories (Local ML $\rightarrow$ Groq LLM) |
| `POST` | `/explain` | Generates PR markdown explanation for regressions (Groq) |
| `POST` | `/review` | Compiles aggregated health analysis metrics (Groq) |

### Backend API (`apps/server` — Express)
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/api/repos` | Lists connected repositories for the authenticated user |
| `GET`  | `/api/repos/:owner/:name/checks` | Retrieves the history of performance check runs |
| `PUT`  | `/api/repos/:owner/:name/thresholds` | Updates size/latency alert thresholds |

---

*Developed and maintained with ❤️ by [Saksham Hans](https://github.com/Saksham842).*
