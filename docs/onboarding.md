# 🛡️ DeployGuard — Integration & Setup Guide

Welcome to **DeployGuard**! This guide will walk you through connecting a new repository to DeployGuard, setting up your CI/CD pipeline, and configuring your performance quality gates.

---

## 🏗️ How it Works

DeployGuard uses a **decentralized build pattern** to keep your code secure and your builds fast:

```
[ Developer PR ] ────▶ [ GitHub Actions Runner ] ────▶ [ DeployGuard Webhook ]
                             (Builds & Measures)             (NLP Analysis & AI Review)
                                     │                                  │
                                     ▼                                  ▼
                            (Uploads bundle-stats)           (Posts PR Checks & Comments)
```

1. **GitHub Actions** runs on your repository to build your application and generate a bundle analysis file.
2. The compilation artifacts are uploaded securely to **GitHub's Artifact storage**.
3. **DeployGuard** receives the completion webhook, downloads the statistics, runs NLP and Groq AI analyses, and posts check runs/comments directly on your Pull Request.

---

## 🚀 Setup Steps

### Step 1: Install the DeployGuard GitHub App
1. Go to your **DeployGuard Dashboard** and click **"+ Add Repository"**.
2. Choose **"Only select repositories"** and select the repository you want to monitor.
3. Grant the required permissions:
   * **Checks (Read & Write)**: To create and update quality gate status indicators.
   * **Pull Requests (Read & Write)**: To post regression analysis reports as comments.
   * **Actions (Read)**: To fetch build completion events and artifact download links.

---

### Step 2: Add the CI Workflow File

Create `.github/workflows/deployguard.yml` and paste the configuration below.  
**This single file works for every repo structure — no edits needed.**

```yaml
name: DeployGuard Bundle Stats

on:
  pull_request:
    branches: ['**']
  push:
    branches: [main, master]

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

      # ── Step 1: Auto-detect which folder contains the frontend ──────────────
      # Searches: root (.), client/, frontend/, src/, apps/web/, web/, app/ …
      # Finds the first directory that has a package.json with a "build" script.
      # Writes FRONTEND_DIR to $GITHUB_ENV so all subsequent steps pick it up.
      - name: Detect frontend directory
        run: |
          FRONTEND_DIR="."
          for dir in . client frontend src apps/web web app packages/web; do
            if [ -f "$dir/package.json" ]; then
              HAS_BUILD=$(node -e "try{const p=require('./$dir/package.json');console.log(p.scripts&&p.scripts.build?'yes':'no')}catch(e){console.log('no')}" 2>/dev/null)
              if [ "$HAS_BUILD" = "yes" ]; then
                FRONTEND_DIR="$dir"
                break
              fi
            fi
          done
          echo "FRONTEND_DIR=$FRONTEND_DIR" >> $GITHUB_ENV
          echo "[DeployGuard] Frontend directory: $FRONTEND_DIR"

      # ── Step 2: Install & Build from the detected directory ─────────────────
      - name: Install Dependencies
        working-directory: ${{ env.FRONTEND_DIR }}
        run: npm install

      - name: Build App
        working-directory: ${{ env.FRONTEND_DIR }}
        run: npm run build
        env:
          NODE_ENV: production

      # ── Step 3: Auto-discover output dir and write stats.json ───────────────
      # Checks dist/, build/, out/, .next/static relative to FRONTEND_DIR.
      # Never exits with code 1 — writes a placeholder on empty builds.
      - name: Generate Bundle Stats
        env:
          FRONTEND_DIR: ${{ env.FRONTEND_DIR }}
        run: |
          node -e "
          const fs   = require('fs');
          const path = require('path');
          const base = process.env.FRONTEND_DIR || '.';

          const outputDirs = ['dist','build','out','.next/static']
            .map(d => path.join(base, d))
            .concat(['dist','build','out']);

          const distDir = outputDirs.find(d => {
            if (!fs.existsSync(d)) return false;
            try { return fs.readdirSync(d).length > 0; } catch { return false; }
          }) || path.join(base, 'dist');

          const walk = (dir) => {
            let r = [];
            try {
              fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
                const p = path.join(dir, e.name);
                if (e.isDirectory()) r = r.concat(walk(p));
                else if (['.js','.mjs','.cjs','.css'].includes(path.extname(e.name).toLowerCase()))
                  r.push({ name: path.relative(distDir, p).split(path.sep).join('/'), size: fs.statSync(p).size });
              });
            } catch(_) {}
            return r;
          };

          const assets = walk(distDir);
          const statsPath = path.join(distDir, 'stats.json');
          fs.mkdirSync(distDir, { recursive: true });

          if (assets.length === 0) {
            console.warn('[DeployGuard] No JS/CSS files found — writing placeholder.');
            fs.writeFileSync(statsPath, JSON.stringify({ assets: [], _warning: 'No bundle files detected' }, null, 2));
          } else {
            fs.writeFileSync(statsPath, JSON.stringify({ assets }, null, 2));
            const kb = (assets.reduce((s,a) => s+a.size, 0) / 1024).toFixed(1);
            console.log('[DeployGuard] ' + assets.length + ' files, ' + kb + ' KB  →  ' + statsPath);
          }
          "

      # ── Step 4: Upload — covers every possible output location ──────────────
      - name: Upload Bundle Stats
        uses: actions/upload-artifact@v4
        with:
          name: bundle-stats
          path: |
            dist/stats.json
            build/stats.json
            out/stats.json
            client/dist/stats.json
            client/build/stats.json
            frontend/dist/stats.json
            frontend/build/stats.json
            src/dist/stats.json
            apps/web/dist/stats.json
            web/dist/stats.json
            app/dist/stats.json
            packages/web/dist/stats.json
          retention-days: 7
          if-no-files-found: warn
```

---

### Step 3: Commit and Push
```bash
git checkout -b setup/deployguard
git add .github/workflows/deployguard.yml
git commit -m "ci: add DeployGuard bundle stats workflow"
git push origin setup/deployguard
```

---

## 🗂️ Supported Project Structures

| Structure | Frontend dir | Detected? |
|-----------|-------------|-----------|
| Standard Vite/CRA at root | `.` | ✅ |
| `client/` + `server/` split | `client` | ✅ |
| `frontend/` monolith | `frontend` | ✅ |
| `apps/web/` Turborepo | `apps/web` | ✅ |
| `web/` or `app/` | `web` / `app` | ✅ |
| `packages/web/` | `packages/web` | ✅ |
| Next.js (`.next/static`) | `.` | ✅ |
| CRA (`build/` output) | `.` | ✅ |

> **Custom structure?** Add your frontend dir to the `for dir in ...` list in the Detect step.

---

## ❓ Frequently Asked Questions

### 1. Why is the DeployGuard check stuck in "Waiting for Bundle Analysis CI..."?
* **Check the Actions tab** — is the `DeployGuard Bundle Stats` job still running?
* **Verify the artifact name** is exactly `bundle-stats` (lowercase, hyphen).
* **Verify the filename** inside the zip is `stats.json`.

### 2. Does my source code ever leave GitHub?
**No.** DeployGuard never downloads, clones, or reads your source code. The Action compiles code on your own runner and only uploads a metadata file (file sizes + names). DeployGuard only reads that metadata.

### 3. What happens if Groq AI is down?
DeployGuard fails gracefully — PR checks and bundle size measurements still run and post. Only the AI-generated natural language summary is skipped.

### 4. How do I change regression thresholds?
1. Log into the Dashboard via GitHub OAuth.
2. Select your repository → **Settings**.
3. Adjust the threshold sliders (default: `±10%` bundle size).

### 5. Do I need a Groq API Key?
No. The local ML classifier handles commit classification without API calls. For high-volume repos, get a free key at [console.groq.com](https://console.groq.com) to avoid shared rate limits.
