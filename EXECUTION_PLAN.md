# 🗺️ DeployGuard — Full Execution Plan

> **Strategy:** Phase-by-phase build plan detailing what to change, in which file, on which deployed service, and in what order.  
> **Philosophy:** *Fix the engine before repainting the dashboard.* UI redesign is intentionally Phase 5.

---

## 🧭 Infrastructure & Service Context

| Service | Path | Stack | Render Service Type | Port | Deployment Target |
|---------|------|-------|---------------------|------|-------------------|
| **Server** | `apps/server` | Node 20 + Express + Octokit | Web Service | `3000` | Render |
| **NLP** | `apps/nlp` | Python 3.11 + FastAPI + Groq | Web Service | `8000` | Render |
| **Web** | `apps/web` | React 18 + Vite | Static / Jamstack | — | Vercel |

> [!NOTE]
> Nothing in Phases 0–4 requires standing up a third service. We are extending the existing two backend services.

---

## 📊 Summary Matrix: What Touches What

| Phase | `apps/server` (Render) | `apps/nlp` (Render) | `apps/web` (Vercel) | DB Migration | Description |
|:-----:|:---------------------:|:-------------------:|:-------------------:|:------------:|:------------|
| **0** | ✅ | — | — | ✅ | Stabilize pipeline (idempotency, retry backoff, smoke test) |
| **1** | ✅ | — | ✅ (status banner) | ✅ | Frictionless onboarding (auto-detect tool, auto-PR) |
| **2** | ✅ | — | — | — | Expand bundler support (Next.js, Webpack, Vite) |
| **3** | ✅ | ✅ (retrain) | — | ✅ | Real `query_count` metric (Prisma contract, pipeline, NLP) |
| **4** | ✅ | ✅ (prompt update) | ✅ | — | Differentiated AI layer (trend warnings, visual chunk diff) |
| **5** | — | — | ✅ (only) | — | Modern developer UI redesign (technical dark tokens) |

---

## 🛠️ Phase 0 — Stabilize the Pipeline (First Priority)
**Goal:** Eliminate webhook duplication and race conditions before building new features on top.

- [x] **0.1 Webhook Idempotency**
  - **Files:** `apps/server/src/db.js`, `apps/server/src/webhook.js`, `db/migrations/002_idempotency.sql`
  - **Render Service:** `apps/server` (redeploy after merge, no new env vars)
  - **Database Migrations:**
    ```sql
    DO $$ BEGIN
      ALTER TABLE checks ADD COLUMN IF NOT EXISTS github_delivery_id TEXT;
      CREATE INDEX IF NOT EXISTS idx_checks_delivery ON checks(github_delivery_id);
      ALTER TABLE checks ADD CONSTRAINT uniq_repo_pr_sha UNIQUE (repo_id, pr_number, head_sha);
    EXCEPTION
      WHEN duplicate_object OR duplicate_table THEN NULL;
    END $$;
    ```
  - **`db.js` Update:** Update `saveCheck()` to use `ON CONFLICT (repo_id, pr_number, head_sha) DO UPDATE SET status = EXCLUDED.status, results = EXCLUDED.results RETURNING id;`.
  - **`webhook.js` Update:** Read `x-github-delivery` from webhook payload/headers and short-circuit duplicate events if a check already exists with `status != 'pending'`.
  - **Auto-migration safety:** Ensure startup migration in `db.js` wraps constraint additions in safe exception-handled blocks.

- [x] **0.2 Retry & Backoff on Artifact Download**
  - **File:** `apps/server/src/analysers/bundle.js`
  - **Render Service:** `apps/server`
  - **Implementation:** Wrap `octokit.rest.actions.downloadArtifact` in a 3-step retry with exponential backoff (250ms, 1s, 4s) to handle GitHub API artifact availability propagation delays.

- [x] **0.3 Core Loop Smoke Tests**
  - **File:** `apps/server/test/pipeline.test.js` & `.github/workflows/bundle-analysis.yml`
  - **Implementation:** Mock `pull_request.opened` → `workflow_run.completed` sequence. Assert exactly 1 check row and 1 PR comment created. Add test step to CI to safeguard Phases 1–4.

---

## 🚀 Phase 1 — Eliminate Onboarding Friction
**Goal:** Installing the GitHub App automatically generates a ready-to-merge setup PR instead of forcing users to copy-paste workflow YAML.

- [x] **1.1 Build Tool Detection on Installation**
  - **Files:** `apps/server/src/webhook.js` (`handleInstallation`), `apps/server/src/detect.js`
  - **Database Migration:** `ALTER TABLE repos ADD COLUMN IF NOT EXISTS build_tool TEXT;`
  - **Logic:** In `detect.js`, inspect default branch `package.json` for `next` (`nextjs`), `vite` (`vite`), `webpack` (`webpack`), `react-scripts` (`cra`), or `unknown`. Store on `repos.build_tool`.

- [x] **1.2 Tool-Specific Workflow Generators**
  - **File:** `apps/server/src/workflowTemplates.js`
  - **Logic:** Generate optimized YAML configurations tailored to Vite, Next.js, and Webpack with appropriate directory detection and artifact upload steps.

- [x] **1.3 Automated Setup PR Creation**
  - **Files:** `apps/server/src/webhook.js`
  - **GitHub App Permission:** Bump `contents` to `write` in GitHub App settings.
  - **Logic:** Create branch `deployguard/setup`, commit `.github/workflows/deployguard.yml`, and open a Pull Request. Skip if the workflow already exists.

- [x] **1.4 Dashboard Setup Status**
  - **Files:** `apps/server/src/routes/api.js`, `apps/web/src/components/RepoCard.jsx`, `apps/web/src/api.js`
  - **Database Migration:**
    ```sql
    ALTER TABLE repos ADD COLUMN IF NOT EXISTS setup_pr_url TEXT;
    ALTER TABLE repos ADD COLUMN IF NOT EXISTS setup_status TEXT DEFAULT 'pending';
    ```
  - **Logic:** Expose `setup_pr_url` and `setup_status` (`'pending'` | `'pr_open'` | `'merged'`). Display "Setup PR Open →" banner on repo cards until first CI run completes.

---

## 📦 Phase 2 — Expand Bundler Support
**Goal:** Native support for Next.js and Webpack builds alongside Vite.

- [x] **2.1 Unified Normalization Layer**
  - **File:** `apps/server/src/analysers/bundle.js`
  - **Logic:** Implement `normalizeStats(rawJson, format)`:
    - `vite`: Extract assets with `.name` and `.size`.
    - `nextjs`: Parse `.next/build-manifest.json` combined with file sizes.
    - `webpack`: Parse standard `stats.json` root `assets: [{ name, size }]`.
  - **Fallback:** Default missing format to `'vite'` for complete backward compatibility.

- [x] **2.2 Format Tagging in Workflows**
  - **File:** `apps/server/src/workflowTemplates.js`
  - **Logic:** Emit metadata `{ format: "nextjs" | "webpack" | "vite" }` into `stats.json`.

---

## ⚡ Phase 3 — Ship Real Second Metric: `query_count`
**Goal:** Deliver real N+1 query regression detection instead of placeholder baselines.

- [x] **3.1 Producer Contract (Prisma / ORM Hook)**
  - **Contract:** Tenant test harness outputs `dist/query-stats.json`:
    ```json
    { "queryCount": 42 }
    ```
  - Document lightweight test harness snippet (`prisma.$use` counting queries in test suites).

- [x] **3.2 Pipeline Integration**
  - **Files:** `apps/server/src/analysers/bundle.js`, `apps/server/src/webhook.js`
  - **Logic:** Update workflow artifact path to `dist/` to package both `stats.json` and `query-stats.json`. Parse `query-stats.json` if present.

- [x] **3.3 Active `computeMetrics()` Calculation**
  - **File:** `apps/server/src/webhook.js`
  - **Logic:** Calculate real delta: `((after - before) / before) * 100` and evaluate against `threshold_config.query_count`.

- [x] **3.4 NLP Model Retraining for Query Regressions**
  - **Files:** `apps/nlp/train_v2.py`, `apps/nlp/model_v2.pkl`
  - **Render Service:** `apps/nlp`
  - **Logic:** Expand dataset with query regression commits (N+1 queries, nested includes, unindexed lookups). Retrain and bake new model into Docker image.

- [x] **3.5 Opt-In Threshold Configuration**
  - **Database Migration:** Ensure `threshold_config` supports `query_tracking_enabled: boolean` (default `false`).

---

## 🧠 Phase 4 — Make the AI Layer Differentiated
**Goal:** Deliver proactive trend warnings and visual chunk breakdowns rather than generic summaries.

- [x] **4.1 Regression Trend Detection**
  - **Files:** `apps/server/src/db.js`, `apps/server/src/routes/api.js`
  - **Logic:** Query last 10 checks per repository. If any `cause_type` appears in $\ge 3$ of the last 5 failing checks, flag a `trend_warning` in `GET /api/repos/:owner/:name/ai-review`.

- [x] **4.2 Visual Chunk Diff Breakdown**
  - **Files:** `apps/server/src/analysers/bundle.js`, `apps/server/src/webhook.js`, `apps/web/src/components/AIReviewCard.jsx`
  - **Logic:** Compute top 5 chunk deltas (`chunkDiff`) between base and head. Render horizontal bar chart in `AIReviewCard.jsx` alongside LLM diagnosis.

---

## 🎨 Phase 5 — Developer-Grade UI Redesign (Final Step)
**Goal:** Transition to a dense, high-contrast, technical interface trusted by developers who read diffs and stack traces.

- [x] **5.1 Technical Token System (`apps/web/src/index.css`)**
  - **Palette:**
    - Background: `#0D0F12` (near-black)
    - Surface Panel: `#161A1F`
    - Hairline Border: `#252B32`
    - Primary Text: `#E8EAED`
    - Muted Text: `#8B92A0`
    - Signal Pass: `#3DD68C`
    - Signal Fail: `#F0605A`
    - Interactive Accent: `#4C8DFF`
  - **Typography:** Inter / IBM Plex Sans for UI; JetBrains Mono / IBM Plex Mono for numbers, SHAs, byte counts, and code symbols.

- [x] **5.2 Component Upgrades**
  - **`MetricChart.jsx`:** Dark panel theme, baseline target reference lines, red/green trendlines.
  - **`RepoCard.jsx` / `Dashboard.jsx`:** Border-separated flat cards; highlight the most recently active repo.
  - **`AIReviewCard.jsx`:** Distinct typographic treatments for Strengths, Risks, and Recommendations.
  - **`CheckRow.jsx`:** Semantic red/green left indicator stripe; smooth height animation on expand.
  - **`ParticleBackground.jsx`:** Replace arbitrary floating particles with purposeful bundle-chunk visualizations or clean minimalist canvas.

- [x] **5.3 Copy & Action Polish**
  - Replace ambiguous labels: "Configure thresholds" instead of "Threshold Config", "View setup PR" instead of "Pending", helpful next-step empty states.

---
*Roadmap ready for execution. Progress can be tracked phase-by-phase.*
