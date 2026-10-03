import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import GsapMagnetic from '../components/GsapMagnetic';

export default function Docs() {
  const [activeSection, setActiveSection] = useState('setup'); // 'setup' | 'architecture' | 'nlp' | 'thresholds' | 'faq'
  const [setupMode, setSetupMode] = useState('auto'); // 'auto' | 'manual'
  const [bundlerTab, setBundlerTab] = useState('vite'); // 'vite' | 'next' | 'db'
  const [copiedKey, setCopiedKey] = useState(null);
  const [activeStep, setActiveStep] = useState(0);

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const manualWorkflows = {
    vite: `name: DeployGuard Bundle Stats

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

      - name: Install Dependencies
        run: npm ci || npm install

      - name: Build Application
        run: npm run build

      - name: Extract Vite Bundle Stats
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
            fs.mkdirSync('dist', { recursive: true });
            fs.writeFileSync('dist/stats.json', JSON.stringify({ format: 'vite', assets }));
          "

      - name: Upload bundle-stats artifact
        uses: actions/upload-artifact@v4
        with:
          name: bundle-stats
          path: dist/stats.json
          retention-days: 7`,

    next: `name: DeployGuard Next.js Stats

on:
  pull_request:
    branches: ['**']
  push:
    branches: [main, master]

jobs:
  bundle-stats:
    runs-on: ubuntu-latest
    name: Upload Next.js stats for DeployGuard

    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install & Build
        run: |
          npm ci || npm install
          npm run build

      - name: Extract Next.js Client Chunks
        run: |
          node -e "
            const fs = require('fs');
            const path = require('path');
            function walk(dir) {
              let res = [];
              if (!fs.existsSync(dir)) return res;
              for (const f of fs.readdirSync(dir)) {
                const full = path.join(dir, f);
                if (fs.statSync(full).isDirectory()) res.push(...walk(full));
                else res.push({ name: path.relative('.next', full), size: fs.statSync(full).size });
              }
              return res;
            }
            const assets = walk('.next/static');
            fs.mkdirSync('dist', { recursive: true });
            fs.writeFileSync('dist/stats.json', JSON.stringify({ format: 'next', assets }));
          "

      - name: Upload bundle-stats artifact
        uses: actions/upload-artifact@v4
        with:
          name: bundle-stats
          path: dist/stats.json
          retention-days: 7`,

    db: `// Example test harness hook for Database Query Regression tracking
// Include in your integration/unit test teardown to emit dist/query-stats.json

import fs from 'fs';
import { dbProfiler } from './test-db-setup';

afterAll(async () => {
  const queryCount = dbProfiler.getQueryCount();
  const slowQueries = dbProfiler.getSlowQueries();

  fs.mkdirSync('dist', { recursive: true });
  fs.writeFileSync('dist/query-stats.json', JSON.stringify({
    queryCount,
    slowQueries,
    timestamp: new Date().toISOString()
  }, null, 2));
});

// Upload dist/query-stats.json alongside stats.json in your GitHub Action:
// uses: actions/upload-artifact@v4
// with:
//   name: bundle-stats
//   path: dist/`
  };

  const steps = [
    {
      title: 'HMAC Webhook Verification',
      subtitle: 'Step 1: Cryptographic Ingestion',
      desc: 'GitHub sends pull_request.opened, synchronize, or closed events. The Express ingestion endpoint verifies the HMAC-SHA256 signature using your GitHub Webhook Secret before reading or dispatching payloads.',
      code: `// apps/server/src/index.js
app.post('/api/webhook', (req, res) => {
  const signature = req.headers['x-hub-signature-256'];
  const isValid = verifyHmacSignature(process.env.GITHUB_WEBHOOK_SECRET, req.rawBody, signature);
  
  if (!isValid) {
    return res.status(401).json({ error: 'Invalid HMAC signature' });
  }

  // Enqueue job or dispatch to webhook handler
  handlePullRequestEvent(req.body);
  return res.status(202).json({ received: true });
});`
    },
    {
      title: 'Fetch Target Baseline',
      subtitle: 'Step 2: Database Historical Query',
      desc: 'DeployGuard queries PostgreSQL to retrieve the last verified performance baseline on the target branch (e.g. main). Baselines are strictly isolated per repo and branch.',
      code: `// Retrieve the latest verified benchmark for the base branch
SELECT value, metric, updated_at
FROM baselines
WHERE repo_id = $1
  AND branch  = $2
  AND metric  IN ('bundle_kb', 'query_count', 'api_p95_ms')
ORDER BY updated_at DESC;`
    },
    {
      title: 'Artifact Extraction & Package Diff',
      subtitle: 'Step 3: Asset Analysis',
      desc: 'Octokit retrieves the bundle-stats artifact produced by GitHub Actions. DeployGuard calculates the exact asset delta and diffs package.json dependencies between base and head SHAs.',
      code: `const bundleResult = await analyseBundle(octokit, owner, repo, headSha);
const pkgDiff = await diffPackageJson(octokit, owner, repo, baseSha, headSha);

// Diff structure:
// {
//   added:    ['@tanstack/react-query'],
//   removed:  ['axios'],
//   upgraded: [{ name: 'react', from: '18.2.0', to: '19.0.0' }]
// }`
    },
    {
      title: 'NLP 3-Tier Classification',
      subtitle: 'Step 4: Root Cause Intelligence',
      desc: 'Commit messages, file diffs, and package modifications are dispatched to our Python FastAPI ML engine. A tiered pipeline classifies whether changes stem from bundle bloat, unindexed DB queries, or latency regressions.',
      code: `# apps/nlp/main.py
@app.post("/classify")
async def classify_cause(payload: CommitContext):
    # Tier 1: Local sentence-transformers (<50ms)
    embedding = model.encode(payload.commit_message)
    proba = classifier.predict_proba([embedding])
    confidence = float(proba.max())

    if confidence >= 0.55:
        return {"cause": classifier.classes_[proba.argmax()], "confidence": confidence}

    # Tier 2: Groq LLaMA 3.1 fallback (~200ms)
    if GROQ_API_KEY:
        return await groq_classify(payload.commit_message)

    # Tier 3: Deterministic best-guess fallback
    return {"cause": classifier.classes_[proba.argmax()], "low_confidence": True}`
    },
    {
      title: 'Threshold Evaluation',
      subtitle: 'Step 5: Regression Check',
      desc: 'Deltas are compared against the repositories configurable safety margins. Every metric (bundle size, query count, latency) must be within tolerance for the check to pass.',
      code: `const bundleDelta = ((headKb - baseKb) / baseKb) * 100;
const queryDelta = headQueries - baseQueries;

const passed = (
  Math.abs(bundleDelta) <= repoThresholds.bundle_kb &&
  queryDelta <= repoThresholds.query_count
);

const conclusion = passed ? 'success' : 'failure';`
    },
    {
      title: 'Check Run & Baseline Promotion',
      subtitle: 'Step 6: GitHub Feedback & Merge Gate',
      desc: 'DeployGuard updates the GitHub Check Run status and posts an in-place markdown comment on the PR with AI analysis. On merge to main, the baseline is promoted to guard future PRs.',
      code: `// Post or update native GitHub Check Run
await octokit.rest.checks.update({
  check_run_id: checkId,
  conclusion: passed ? 'success' : 'failure',
  output: {
    title: passed ? 'DeployGuard: All Performance Gates Passed' : 'DeployGuard: Performance Regression Detected',
    summary: buildCheckSummary(metrics, aiSummary)
  }
});

// Strict baseline protection: Only promote on merge + pass
if (isMergeToMain && passed) {
  await promoteBaseline(repoId, 'main', newMetrics);
}`
    }
  ];

  const nlpTiers = [
    {
      tier: 'Tier 1',
      label: 'Local ML Vector Classifier',
      color: '#8B5CF6',
      bg: 'rgba(139, 92, 246, 0.1)',
      border: 'rgba(139, 92, 246, 0.3)',
      latency: '< 50ms',
      badge: 'Offline · Zero Token Cost',
      tech: 'all-MiniLM-L6-v2 + LogisticRegression',
      desc: 'Generates 384-dimensional dense semantic embeddings for commit titles and descriptions. Resolves the regression cause instantly when confidence is ≥ 0.55.'
    },
    {
      tier: 'Tier 2',
      label: 'Groq LLaMA 3.1 8B Instant',
      color: '#06B6D4',
      bg: 'rgba(6, 182, 212, 0.1)',
      border: 'rgba(6, 182, 212, 0.3)',
      latency: '~200ms',
      badge: 'Escalation Fallback',
      tech: 'llama-3.1-8b-instant (Groq LPU Engine)',
      desc: 'Invoked automatically when Tier 1 confidence is below 0.55 or commits contain unstructured semantic changes. Returns a structured JSON diagnosis and actionable fix.'
    },
    {
      tier: 'Tier 3',
      label: 'Deterministic Best-Guess Fallback',
      color: '#10B981',
      bg: 'rgba(16, 185, 129, 0.1)',
      border: 'rgba(16, 185, 129, 0.3)',
      latency: '< 1ms',
      badge: 'High-Availability Sentinel',
      tech: 'Softmax Probability Ranking',
      desc: 'Guarantees that CI checks never hang or crash if external AI providers experience outages. Flags the response with low_confidence: true for transparency.'
    }
  ];

  return (
    <div className="relative space-y-12 pb-24">
      {/* Ambient background glow orbs */}
      <div className="glow-orb-violet -top-20 -left-20" />
      <div className="glow-orb-cyan top-96 -right-20" />

      {/* Hero Header */}
      <div className="relative z-10 pt-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400 text-xs font-mono mb-4">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          DEPLOYGUARD DEVELOPER PLATFORM &amp; CI INTEGRATION
        </div>
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white mb-4">
          Architecture &amp; <span className="text-gradient-violet">Developer Documentation</span>
        </h1>
        <p className="text-[#9CA3AF] text-sm sm:text-base max-w-3xl leading-relaxed">
          DeployGuard protects your production builds by monitoring bundle bloat, database query regressions,
          and API latency directly inside GitHub Pull Requests. Review the integration workflow and the 
          underlying 3-tier NLP engine below.
        </p>

        {/* Section Navigation Tabs */}
        <div className="flex flex-wrap gap-2 mt-8 p-1.5 bg-[#0E1118]/80 backdrop-blur-xl border border-white/[0.08] rounded-xl w-fit">
          {[
            { id: 'setup', label: 'CI Setup & Workflows' },
            { id: 'architecture', label: '6-Step Event Engine' },
            { id: 'nlp', label: '3-Tier NLP Pipeline' },
            { id: 'thresholds', label: 'Performance Thresholds' },
            { id: 'faq', label: 'Security & FAQs' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeSection === tab.id
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-[0_0_15px_rgba(124,58,237,0.4)]'
                  : 'text-[#9CA3AF] hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: CI SETUP & ONBOARDING (REPLACES STANDALONE SETUP MODAL) */}
      {/* ========================================================================= */}
      {activeSection === 'setup' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-8 relative z-10"
        >
          {/* Setup Mode Switcher */}
          <div className="panel flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <span>Repository Onboarding</span>
                <span className="text-[11px] font-mono font-normal text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Zero Maintenance
                </span>
              </h2>
              <p className="text-xs text-[#9CA3AF] mt-1">
                Choose between automated one-click PR generation or manual workflow customization.
              </p>
            </div>

            <div className="flex bg-[#08090C] p-1 rounded-lg border border-white/[0.08] text-xs font-mono">
              <button
                onClick={() => setSetupMode('auto')}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  setupMode === 'auto'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                Automated (Recommended)
              </button>
              <button
                onClick={() => setSetupMode('manual')}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  setupMode === 'manual'
                    ? 'bg-violet-600 text-white shadow-sm'
                    : 'text-[#9CA3AF] hover:text-white'
                }`}
              >
                Manual YAML Template
              </button>
            </div>
          </div>

          {setupMode === 'auto' ? (
            /* Automated Setup Flow */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {[
                {
                  step: '01',
                  title: 'Install GitHub App',
                  desc: 'Grant DeployGuard permission to your repository. The app requires Checks, Pull Requests, and Repository Metadata permissions.',
                  action: (
                    <GsapMagnetic strength={0.3}>
                      <a
                        href="https://github.com/apps/deployguard-saksham842"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary text-xs shadow-lg mt-3"
                      >
                        Install GitHub App →
                      </a>
                    </GsapMagnetic>
                  )
                },
                {
                  step: '02',
                  title: 'Automated Bundler Detection',
                  desc: 'DeployGuard scans package.json in the default branch, detects whether you use Vite, Next.js, or Webpack, and drafts the tailored workflow file.',
                  tag: 'Vite · Next.js · Webpack'
                },
                {
                  step: '03',
                  title: 'Merge the Setup PR',
                  desc: 'DeployGuard commits .github/workflows/deployguard.yml to branch deployguard/setup and opens a PR. Once merged, performance baseline tracking goes live.',
                  tag: 'Instant Baseline Activation'
                }
              ].map((card, idx) => (
                <div key={idx} className="card relative flex flex-col justify-between p-6">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-mono text-2xl font-black text-violet-400/40">
                        {card.step}
                      </span>
                      {card.tag && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] border border-white/[0.08] text-[#9CA3AF]">
                          {card.tag}
                        </span>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-white mb-2">{card.title}</h3>
                    <p className="text-xs text-[#9CA3AF] leading-relaxed">{card.desc}</p>
                  </div>
                  {card.action && <div className="mt-4">{card.action}</div>}
                </div>
              ))}
            </div>
          ) : (
            /* Manual YAML Template with Bundler Tabs */
            <div className="panel space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-white/[0.08]">
                <div className="flex gap-2">
                  {[
                    { id: 'vite', label: 'Vite Workflow' },
                    { id: 'next', label: 'Next.js Workflow' },
                    { id: 'db', label: 'Query Tracker Hook' },
                  ].map((b) => (
                    <button
                      key={b.id}
                      onClick={() => setBundlerTab(b.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer ${
                        bundlerTab === b.id
                          ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                          : 'text-[#9CA3AF] hover:text-white bg-white/[0.02]'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => copyToClipboard(manualWorkflows[bundlerTab], bundlerTab)}
                  className="btn btn-ghost text-xs font-mono flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedKey === bundlerTab ? (
                    <span className="text-emerald-400">Copied to clipboard</span>
                  ) : (
                    <span>Copy snippet</span>
                  )}
                </button>
              </div>

              <div className="relative">
                <div className="text-[11px] font-mono text-[#9CA3AF] mb-2">
                  {bundlerTab === 'db' ? (
                    <span>Save in your test suite harness or test setup file:</span>
                  ) : (
                    <span>Save to <code className="text-violet-400 font-bold">.github/workflows/deployguard.yml</code>:</span>
                  )}
                </div>
                <div className="bg-[#08090C] border border-white/[0.08] rounded-xl p-4 overflow-x-auto max-h-[380px]">
                  <pre className="text-xs font-mono text-[#E8EAED] leading-relaxed">
                    <code>{manualWorkflows[bundlerTab]}</code>
                  </pre>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: 6-STEP EVENT ARCHITECTURE */}
      {/* ========================================================================= */}
      {activeSection === 'architecture' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-8 relative z-10"
        >
          <div className="panel">
            <h2 className="text-lg font-bold text-white mb-1">
              Event-Driven Verification Loop
            </h2>
            <p className="text-xs text-[#9CA3AF]">
              Every pull request triggers an automated 6-step lifecycle from HMAC webhook ingestion to GitHub Check Run updates.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Step navigation list */}
            <div className="lg:col-span-5 space-y-2">
              {steps.map((s, idx) => (
                <div
                  key={idx}
                  onClick={() => setActiveStep(idx)}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer flex items-center gap-3.5 ${
                    activeStep === idx
                      ? 'bg-violet-500/15 border-violet-500/50 shadow-[0_0_20px_rgba(124,58,237,0.2)]'
                      : 'bg-[#0E1118]/80 border-white/[0.08] hover:border-white/[0.2] hover:bg-white/[0.02]'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono text-xs font-bold shrink-0 ${
                    activeStep === idx ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40' : 'bg-white/[0.04] text-[#6B7280] border border-white/[0.06]'
                  }`}>
                    0{idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] font-mono text-violet-400/90 uppercase tracking-wider">
                      {s.subtitle}
                    </div>
                    <div className="text-xs font-semibold text-white truncate">
                      {s.title}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Step code & detailed preview */}
            <div className="lg:col-span-7 panel flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-white/[0.08] mb-4">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-violet-400 px-2 py-0.5 rounded bg-violet-500/10 border border-violet-500/20">
                      0{activeStep + 1}
                    </span>
                    <h3 className="text-sm font-bold text-white">
                      {steps[activeStep].title}
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-[#9CA3AF] px-2 py-0.5 rounded bg-white/[0.03] border border-white/[0.08]">
                    Step {activeStep + 1} of {steps.length}
                  </span>
                </div>

                <p className="text-xs text-[#9CA3AF] leading-relaxed mb-4">
                  {steps[activeStep].desc}
                </p>

                <div className="relative">
                  <div className="flex items-center justify-between bg-[#08090C] px-3 py-1.5 border-t border-x border-white/[0.08] rounded-t-lg">
                    <span className="text-[10px] font-mono text-[#6B7280]">Implementation Snippet</span>
                    <button
                      onClick={() => copyToClipboard(steps[activeStep].code, `step-${activeStep}`)}
                      className="text-[10px] font-mono text-violet-400 hover:text-violet-300 cursor-pointer"
                    >
                      {copiedKey === `step-${activeStep}` ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="bg-[#08090C] border border-white/[0.08] rounded-b-lg p-3 overflow-x-auto max-h-64">
                    <pre className="text-xs font-mono text-[#E8EAED] leading-relaxed">
                      <code>{steps[activeStep].code}</code>
                    </pre>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 mt-4 border-t border-white/[0.08]">
                <button
                  disabled={activeStep === 0}
                  onClick={() => setActiveStep(prev => prev - 1)}
                  className="btn btn-ghost text-xs disabled:opacity-30 disabled:pointer-events-none"
                >
                  ← Previous Step
                </button>
                <button
                  disabled={activeStep === steps.length - 1}
                  onClick={() => setActiveStep(prev => prev + 1)}
                  className="btn btn-primary text-xs disabled:opacity-30 disabled:pointer-events-none"
                >
                  Next Step →
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: 3-TIER NLP CAUSATION ENGINE */}
      {/* ========================================================================= */}
      {activeSection === 'nlp' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-8 relative z-10"
        >
          <div className="panel">
            <h2 className="text-lg font-bold text-white mb-1">
              3-Tier Semantic Classification Pipeline
            </h2>
            <p className="text-xs text-[#9CA3AF]">
              DeployGuard combines local vector embeddings for sub-millisecond execution with Groq LLaMA 3.1 LLM fallback for deep architectural context.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {nlpTiers.map((tier, idx) => (
              <div
                key={idx}
                className="card relative flex flex-col justify-between p-6"
                style={{
                  borderColor: tier.border,
                  boxShadow: `0 0 25px -10px ${tier.color}22`
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className="text-xs font-mono font-bold px-2 py-0.5 rounded"
                      style={{ color: tier.color, background: tier.bg, border: `1px solid ${tier.border}` }}
                    >
                      {tier.tier}
                    </span>
                    <span className="text-[11px] font-mono text-[#9CA3AF]">
                      {tier.latency}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-white mb-1">{tier.label}</h3>
                  <div className="text-[11px] font-mono text-violet-400 mb-3">{tier.tech}</div>
                  <p className="text-xs text-[#9CA3AF] leading-relaxed">{tier.desc}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-white/[0.08] text-[10px] font-mono text-[#6B7280]">
                  {tier.badge}
                </div>
              </div>
            ))}
          </div>

          {/* Sample Classifier Response */}
          <div className="panel space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white">Example NLP Diagnostic Payload</span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Live Schema v2
              </span>
            </div>
            <div className="bg-[#08090C] border border-white/[0.08] rounded-xl p-4 overflow-x-auto">
              <pre className="text-xs font-mono text-[#E8EAED] leading-relaxed">
                <code>{`{
  "cause": "bundle_bloat",
  "confidence": 0.942,
  "tier_executed": "tier_1_local_ml",
  "latency_ms": 38,
  "top_features": [
    "added full-bundle lodash import instead of lodash-es",
    "framer-motion bundle chunk increase (+142 KB)"
  ],
  "recommendation": "Import methods directly: import debounce from 'lodash/debounce';"
}`}</code>
              </pre>
            </div>
          </div>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 4: CONFIGURABLE PERFORMANCE THRESHOLDS */}
      {/* ========================================================================= */}
      {activeSection === 'thresholds' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-8 relative z-10"
        >
          <div className="panel">
            <h2 className="text-lg font-bold text-white mb-1">
              Per-Repository Guardrails
            </h2>
            <p className="text-xs text-[#9CA3AF]">
              Tune tolerances per repository from the repository settings dashboard or update them programmatically via our REST API.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              {
                name: 'Bundle Growth Limit',
                key: 'bundle_kb',
                defaultVal: '±10%',
                unit: 'Percentage Delta',
                desc: 'Maximum percentage increase in JavaScript & CSS bundle assets allowed relative to the target branch baseline.'
              },
              {
                name: 'Database Query Spike',
                key: 'query_count',
                defaultVal: '±20 queries',
                unit: 'Absolute Count',
                desc: 'Maximum increase in SQL queries executed during test runs. Catches N+1 query patterns before deployment.'
              },
              {
                name: 'API p95 Latency',
                key: 'api_p95_ms',
                defaultVal: '±20%',
                unit: 'Percentage Delta',
                desc: 'Prevents blocking event loop work and sluggish database indexes by catching latency degradation early.'
              }
            ].map((metric, idx) => (
              <div key={idx} className="card p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-mono text-xs text-violet-300 bg-violet-500/10 px-2 py-0.5 rounded border border-violet-500/20">
                      {metric.key}
                    </span>
                    <span className="text-[10px] font-mono text-[#6B7280] uppercase tracking-wider">
                      {metric.unit}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white mb-2">{metric.name}</h3>
                  <div className="inline-block px-2 py-0.5 rounded bg-white/[0.03] border border-white/[0.08] text-[#9CA3AF] text-[11px] font-mono mb-3">
                    Default: <span className="text-white font-medium">{metric.defaultVal}</span>
                  </div>
                  <p className="text-xs text-[#9CA3AF] leading-relaxed">{metric.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* REST API Example */}
          <div className="panel space-y-3">
            <div className="text-xs font-bold text-white">REST API Threshold Mutation</div>
            <div className="bg-[#08090C] border border-white/[0.08] rounded-xl p-4 overflow-x-auto">
              <pre className="text-xs font-mono text-[#E8EAED] leading-relaxed">
                <code>{`PUT /api/repos/:owner/:name/thresholds
Content-Type: application/json
Authorization: Bearer <dg_token>

{
  "bundle_kb": 8,       // Fail if bundle size increases > 8%
  "query_count": 15,    // Fail if test query count increases > 15
  "api_p95_ms": 15      // Fail if p95 response time degrades > 15%
}`}</code>
              </pre>
            </div>
          </div>
        </motion.div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 5: SECURITY & FAQS */}
      {/* ========================================================================= */}
      {activeSection === 'faq' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-6 relative z-10"
        >
          <div className="panel">
            <h2 className="text-lg font-bold text-white mb-1">
              Security Architecture &amp; FAQs
            </h2>
            <p className="text-xs text-[#9CA3AF]">
              DeployGuard is engineered with a strict zero-code-leak security model.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              {
                q: 'Does source code ever leave our GitHub runner?',
                a: 'Never. Your GitHub Actions runner executes the compilation locally inside your own runner container. Only the generated metadata stats.json file (asset names and byte sizes) is uploaded as a build artifact.'
              },
              {
                q: 'Which bundlers and frameworks are supported?',
                a: 'Out of the box: Vite, Next.js (App & Pages routers), Webpack 5, and Create React App. Any build tool that produces static assets can emit a simple { format: "custom", assets: [...] } stats file.'
              },
              {
                q: 'How does DeployGuard prevent baseline drift?',
                a: 'Baselines are only promoted when a pull request is merged into your production branch (main/master) AND has passed all performance thresholds. Regressed branches never pollute the baseline.'
              },
              {
                q: 'What GitHub App permissions does DeployGuard require?',
                a: 'DeployGuard requires read/write access to Checks (to emit Check Runs), Pull Requests (to leave interactive regression comments), and read access to repository contents.'
              }
            ].map((faq, idx) => (
              <div key={idx} className="card p-6">
                <h3 className="text-sm font-bold text-white mb-2">{faq.q}</h3>
                <p className="text-xs text-[#9CA3AF] leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
