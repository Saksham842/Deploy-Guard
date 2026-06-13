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
          cache: 'npm'
          cache-dependency-path: 'package-lock.json' # Change path if using a monorepo

      - name: Install Dependencies
        run: npm ci

      # ─── BUILD STEP (Choose/uncomment the one matching your bundler) ───
      
      # OPTION A: Vite Projects (Default)
      # Ensure 'rollup-plugin-visualizer' is configured to output JSON.
      - name: Build Vite App
        run: npm run build
        env:
          NODE_ENV: production

      # OPTION B: Next.js Projects
      # - name: Build Next.js
      #   run: npx next build --profile --json > dist/stats.json

      # OPTION C: Webpack Projects
      # - name: Build Webpack App
      #   run: npx webpack --profile --json > dist/stats.json

      # ─── UPLOAD STEP (Required) ───
      # DeployGuard looks for an artifact named exactly "bundle-stats"
      - name: Upload Bundle Stats
        uses: actions/upload-artifact@v4
        with:
          name: bundle-stats
          path: dist/stats.json   # Path to your stats.json output
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
* **Verify the Artifact name:** Ensure the artifact uploaded in step 6 is named exactly `bundle-stats` (lowercase, with a hyphen).
* **Verify the Filename:** The bundle statistics must be written to a file named `stats.json` inside the uploaded zip.

### 2. Does my source code ever leave GitHub?
**No.** DeployGuard never downloads, clones, or reads your proprietary source code. The GitHub Action compiles your code on your own secure runner, and only uploads a metadata JSON file (`stats.json`) containing file sizes and dependency names. DeployGuard only reads this metadata file.

### 3. What happens if the Groq AI service is down?
DeployGuard fails gracefully. If the Groq API fails or rate-limits, your PR checks and build size measurements will still run and post. Only the AI-generated natural language summary and PR recommendations will be omitted.

### 4. How do I change the regression thresholds?
You can configure limits (e.g., maximum allowable bundle size increase or query counts) on the **DeployGuard Dashboard**:
1. Log into the Dashboard using GitHub OAuth.
2. Select your repository.
3. Go to **Settings** and modify the threshold configuration (default is `+10 KB` for bundle sizes and `+20` database queries).

### 5. Can I use DeployGuard on a monorepo?
**Yes.** You will just need to point the `cache-dependency-path` and build folders to your sub-project. For example, change:
```yaml
cache-dependency-path: 'apps/web/package-lock.json'
path: 'apps/web/dist/stats.json'
```

### 6. Do I need to buy a Groq API Key?
No. DeployGuard comes pre-configured with a fallback API key, but for high-volume repositories, we recommend supplying your own free API key under the dashboard settings to avoid shared rate limits.
