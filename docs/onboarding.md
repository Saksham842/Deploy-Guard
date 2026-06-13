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

Follow these three steps to integrate a new repository.

### Step 1: Install the DeployGuard GitHub App
Add DeployGuard to your personal account or organization:
1. Go to your **DeployGuard Dashboard** and click **"+ Add Repository"** (or install the app directly via GitHub).
2. Choose **"Only select repositories"** and select the repository you want to monitor.
3. Grant the required permissions:
   * **Checks (Read & Write)**: To create and update quality gate status indicators.
   * **Pull Requests (Read & Write)**: To post regression analysis reports as comments.
   * **Actions (Read)**: To fetch build completion events and artifact download links.

---

### Step 2: Add the CI Workflow File
To allow DeployGuard to read your build sizes, you need to export and upload a `stats.json` file.

Create a new file at `.github/workflows/deployguard.yml` in your repository and paste the following configuration:

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
          # Note: cache: 'npm' is intentionally omitted — it requires a root-level
          # package-lock.json which many repos (monorepos, yarn, pnpm) don't have.

      - name: Install Dependencies
        run: npm install

      - name: Build App
        run: npm run build
        env:
          NODE_ENV: production

      # ─── Generate Bundle Stats (Automatic, no configuration needed) ───────────
      # This inline script auto-discovers your build output folder (dist/, build/,
      # out/, .next/static) and writes a webpack-compatible stats.json.
      # It never fails the job — if no bundle files are found it writes a warning.
      - name: Generate Bundle Stats
        run: |
          node -e "
          const fs = require('fs');
          const path = require('path');

          /* Auto-discover the build output folder */
          const candidates = ['dist', 'build', 'out', '.next/static'];
          const distDir = candidates.find(d => fs.existsSync(d)) || 'dist';

          const walk = (dir) => {
            let results = [];
            try {
              fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
                const p = path.join(dir, e.name);
                if (e.isDirectory()) results = results.concat(walk(p));
                else {
                  const ext = path.extname(e.name).toLowerCase();
                  if (['.js', '.mjs', '.cjs', '.css'].includes(ext)) {
                    results.push({
                      name: path.relative(distDir, p).split(path.sep).join('/'),
                      size: fs.statSync(p).size
                    });
                  }
                }
              });
            } catch (_) {}
            return results;
          };

          const assets = walk(distDir);

          if (assets.length === 0) {
            console.warn('[DeployGuard] No JS/CSS bundle files found in ' + distDir + '/.');
            console.warn('[DeployGuard] Writing placeholder stats.json so upload succeeds.');
            fs.mkdirSync(distDir, { recursive: true });
            fs.writeFileSync(
              path.join(distDir, 'stats.json'),
              JSON.stringify({ assets: [], _warning: 'No bundle files detected' }, null, 2)
            );
          } else {
            fs.writeFileSync(
              path.join(distDir, 'stats.json'),
              JSON.stringify({ assets }, null, 2)
            );
            const totalKb = (assets.reduce((s, a) => s + a.size, 0) / 1024).toFixed(1);
            console.log('[DeployGuard] Bundle: ' + assets.length + ' files, ' + totalKb + ' KB total');
          }
          "

      # ─── UPLOAD STEP (Required) ──────────────────────────────────────────────
      # DeployGuard looks for an artifact named exactly "bundle-stats"
      - name: Upload Bundle Stats
        uses: actions/upload-artifact@v4
        with:
          name: bundle-stats
          path: |
            dist/stats.json
            build/stats.json
            out/stats.json
          retention-days: 7       # Auto-cleanup after 7 days
          if-no-files-found: warn
```

---

### Step 3: Commit and Push
Save the file, push it to your repository, and open a Pull Request.
```bash
git checkout -b setup/deployguard
git add .github/workflows/deployguard.yml
git commit -m "ci: add DeployGuard bundle stats workflow"
git push origin setup/deployguard
```
Once the Pull Request is open, you will see the **DeployGuard** check run automatically appear, waiting for the GitHub Action to finish compiling.

---

## ❓ Frequently Asked Questions (FAQs)

### 1. Why is the DeployGuard check stuck in "Waiting for Bundle Analysis CI..."?
This means DeployGuard received the PR event, but the companion GitHub Actions workflow hasn't finished running or uploaded the artifact yet.
* **Check the Actions tab** in your repository. Is the `DeployGuard Bundle Stats` job still running?
* **Verify the Artifact name:** Ensure the artifact uploaded is named exactly `bundle-stats` (lowercase, with a hyphen).
* **Verify the Filename:** The bundle statistics must be written to a file named `stats.json` inside the uploaded zip.

### 2. Does my source code ever leave GitHub?
**No.** DeployGuard never downloads, clones, or reads your proprietary source code. The GitHub Action compiles your code on your own secure runner, and only uploads a metadata JSON file (`stats.json`) containing file sizes and dependency names. DeployGuard only reads this metadata file.

### 3. What happens if the Groq AI service is down?
DeployGuard fails gracefully. If the Groq API fails or rate-limits, your PR checks and build size measurements will still run and post. Only the AI-generated natural language summary and PR recommendations will be omitted.

### 4. How do I change the regression thresholds?
You can configure limits (e.g., maximum allowable bundle size increase or query counts) on the **DeployGuard Dashboard**:
1. Log into the Dashboard using GitHub OAuth.
2. Select your repository.
3. Go to **Settings** and modify the threshold configuration (default is `+10%` for bundle sizes).

### 5. Can I use DeployGuard on a monorepo or project with subfolders?
**Yes.** The default workflow already auto-discovers `dist/`, `build/`, `out/`, and `.next/static`. If your build script outputs to a custom folder or you run from a subdirectory:

1. **Add `working-directory`** to Install, Build, and Generate steps.
2. **Update Upload Path** to point to `<your-folder>/dist/stats.json`.

Example configuration for a subfolder named `frontend`:
```yaml
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Dependencies
        working-directory: frontend
        run: npm install

      - name: Build App
        working-directory: frontend
        run: npm run build
        env:
          NODE_ENV: production

      - name: Generate Bundle Stats
        working-directory: frontend
        run: |
          node -e "
          const fs = require('fs'), path = require('path');
          const candidates = ['dist', 'build', 'out'];
          const distDir = candidates.find(d => fs.existsSync(d)) || 'dist';
          const walk = (dir) => { let r = []; try { fs.readdirSync(dir, { withFileTypes: true }).forEach(e => { const p = path.join(dir, e.name); if (e.isDirectory()) r = r.concat(walk(p)); else if (['.js','.mjs','.cjs','.css'].includes(path.extname(e.name).toLowerCase())) r.push({ name: path.relative(distDir, p).split(path.sep).join('/'), size: fs.statSync(p).size }); }); } catch(_) {} return r; };
          const assets = walk(distDir);
          fs.mkdirSync(distDir, { recursive: true });
          fs.writeFileSync(path.join(distDir, 'stats.json'), JSON.stringify({ assets }, null, 2));
          console.log('[DeployGuard] ' + assets.length + ' bundle files written.');
          "

      - name: Upload Bundle Stats
        uses: actions/upload-artifact@v4
        with:
          name: bundle-stats
          path: frontend/dist/stats.json
          retention-days: 7
          if-no-files-found: warn
```

### 6. Do I need a Groq API Key?
No. DeployGuard's NLP service falls back gracefully when Groq is unavailable. The local ML classifier (SentenceTransformer) handles commit classification without any API calls. For high-volume repositories, you can supply your own free API key from [console.groq.com](https://console.groq.com) to avoid shared rate limits.
