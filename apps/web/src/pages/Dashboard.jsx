import { useState, useEffect } from 'react';
import { api } from '../api';
import RepoCard from '../components/RepoCard';
import { useSearchParams } from 'react-router-dom';

export default function Dashboard() {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    api.getRepos()
      .then(data => { setRepos(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });

    // Show onboarding only if it hasn't been shown before (signup/first login)
    // or if the user clicked the Setup Guide link in the Navbar (?setup=true)
    const onboardingShown = localStorage.getItem('dg_onboarding_shown');
    const forceSetup = searchParams.get('setup') === 'true';
    if (!onboardingShown || forceSetup) {
      setShowOnboarding(true);
    }
  }, [searchParams]);

  const passCount = repos.filter(r => r.last_check?.status === 'pass').length;
  const failCount = repos.filter(r => r.last_check?.status === 'fail').length;
  const totalChecks = repos.reduce((acc, r) => acc + (r.check_count || 0), 0);

  return (
    <>
      {showOnboarding && (
        <OnboardingModal 
          onClose={() => {
            localStorage.setItem('dg_onboarding_shown', 'true');
            setShowOnboarding(false);
            setSearchParams({}); // Clear ?setup=true from URL
          }} 
        />
      )}
      <div className="animate-[fadeIn_0.4s_ease_forwards]">

        {/* Header */}
        <div className="mb-8 relative z-10">
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1">
            Dashboard
          </h1>
          <p className="text-slate-400 text-sm">
            Performance baseline monitoring across all connected repositories
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8 relative z-10">
          <StatCard label="Connected Repos" value={repos.length} icon="📦" />
          <StatCard label="Passing" value={passCount} icon="✅" color="green" />
          <StatCard label="Failing" value={failCount} icon="❌" color="red" />
          <StatCard label="Total Checks" value={totalChecks} icon="🔍" />
        </div>

        {/* Repos grid */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-[#0f1629]/75 border border-[#1e2d4a]/80 rounded-xl p-5 backdrop-blur-sm">
                <div className="animate-pulse bg-[#1e2d4a]/50 h-[18px] w-3/5 rounded-md mb-3" />
                <div className="animate-pulse bg-[#1e2d4a]/50 h-[14px] w-2/5 rounded-md mb-2" />
                <div className="animate-pulse bg-[#1e2d4a]/50 h-[14px] w-4/5 rounded-md" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-500 font-medium relative z-10">
            ⚠️ {error}
          </div>
        )}

        {!loading && !error && repos.length === 0 && (
          <EmptyState />
        )}

        {!loading && repos.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
            {repos.map(repo => <RepoCard key={repo.id} repo={repo} />)}
          </div>
        )}
      </div>
    </>
  );
}

function StatCard({ label, value, icon, color }) {
  const valueColorClass = color === 'green' ? 'text-green-500' : color === 'red' ? 'text-red-500' : 'text-white';
  
  return (
    <div className="bg-[#0f1629]/75 border border-[#1e2d4a]/85 backdrop-blur-md rounded-xl p-5 shadow-lg flex flex-col justify-between">
      <div className="text-xs font-semibold text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className={`text-3xl font-extrabold mt-2 ${valueColorClass}`}>
        {value}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-16 px-4 bg-[#0f1629]/50 border border-[#1e2d4a]/40 rounded-2xl max-w-md mx-auto backdrop-blur-md shadow-xl relative z-10">
      <div className="text-5xl mb-4">🔭</div>
      <h2 className="text-lg font-bold text-white mb-2">No repos connected yet</h2>
      <p className="text-xs text-slate-400 mb-6 max-w-[280px] mx-auto leading-relaxed">
        Install the DeployGuard GitHub App on your repositories to start tracking performance regressions.
      </p>
      <a
        href="https://github.com/apps/deployguard-saksham842"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold tracking-wide transition-all shadow-[0_4px_12px_rgba(59,130,246,0.2)] hover:-translate-y-0.5 cursor-pointer"
      >
        Install GitHub App →
      </a>
    </div>
  );
}

function OnboardingModal({ onClose }) {
  const [activeTab, setActiveTab] = useState('steps'); // 'steps' | 'faqs'
  const [activeStep, setActiveStep] = useState(0);
  const [copied, setCopied] = useState(false);

  const steps = [
    {
      title: 'Install the GitHub App',
      icon: '⚙️',
      content: (
        <div>
          <p className="text-slate-300 text-sm mb-4">
            Connect DeployGuard to your personal account or organization to begin monitoring.
          </p>
          <ol className="list-decimal list-inside text-xs text-slate-400 space-y-2.5 bg-[#0f1629]/50 border border-[#1e2d4a]/40 rounded-xl p-4">
            <li>Go to the <a href="https://github.com/apps/deployguard-saksham842" target="_blank" rel="noopener noreferrer" className="text-blue-500 font-bold hover:underline">DeployGuard Installation Page</a>.</li>
            <li>Click <strong>Install</strong> and choose your target account.</li>
            <li>Select <strong>"Only select repositories"</strong> and pick the repositories you want to monitor.</li>
            <li>Authorize the requested permissions (Checks: Read & Write, PRs: Read & Write, Actions: Read).</li>
          </ol>
        </div>
      )
    },
    {
      title: 'Add the CI Workflow File',
      icon: '📄',
      content: (
        <div>
          <p className="text-slate-300 text-sm mb-3">
            Create <code className="text-blue-400 font-mono text-xs">.github/workflows/deployguard.yml</code> and paste the config below.
            The workflow <strong className="text-white">auto-detects your project structure</strong> — no edits needed for root, <code className="text-blue-400 font-mono text-xs">client/</code>, <code className="text-blue-400 font-mono text-xs">frontend/</code>, monorepos, or Next.js.
          </p>
          <div className="mb-3">
            <span className="text-[10px] text-slate-500 font-semibold tracking-widest uppercase block mb-1">📁 Place the file here:</span>
            <pre className="bg-[#0d1117] border border-[#21262d] rounded-xl p-3 text-xs text-[#c9d1d9] font-mono leading-relaxed select-none">
{`your-project-root/
└── .github/
    └── workflows/
        └── deployguard.yml  ← (create this file)`}
            </pre>
          </div>
          <p className="text-slate-400 text-[11px] mb-3 leading-relaxed">
            Your source code never leaves GitHub — the Action builds and measures inside your own runner, then uploads only a metadata file (file sizes). See the <strong>Structures</strong> tab for full compatibility details.
          </p>
        </div>
      ),
      code: `name: DeployGuard Bundle Stats

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

      # ── Step 1: Auto-detect which folder contains the frontend ─────────────
      # Checks common locations (root, client/, frontend/, src/, apps/web/, etc.)
      # for a package.json that has a "build" script, then exports FRONTEND_DIR
      # so every subsequent step uses the right working directory automatically.
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

      # ── Step 2: Install & Build from the detected directory ────────────────
      - name: Install Dependencies
        working-directory: \${{ env.FRONTEND_DIR }}
        run: npm install

      - name: Build App
        working-directory: \${{ env.FRONTEND_DIR }}
        run: npm run build
        env:
          NODE_ENV: production

      # ── Step 3: Scan for bundle files and write stats.json ─────────────────
      # Looks for JS/CSS output in dist/, build/, out/, .next/static relative
      # to the detected frontend directory. Never exits with code 1 — writes a
      # placeholder if no bundle files are found so the upload step succeeds.
      - name: Generate Bundle Stats
        env:
          FRONTEND_DIR: \${{ env.FRONTEND_DIR }}
        run: |
          node -e "
          const fs   = require('fs');
          const path = require('path');
          const base = process.env.FRONTEND_DIR || '.';

          const outputDirs = ['dist','build','out','.next/static']
            .map(d => path.join(base, d))
            .concat(['dist','build','out']); // also check root as fallback

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

      # ── Step 4: Upload — covers every possible output location ─────────────
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
          if-no-files-found: warn`
    },
    {
      title: 'Commit and Verify',
      icon: '🚀',
      content: (
        <div>
          <p className="text-slate-300 text-sm mb-4">
            Push the new workflow to a branch and open a Pull Request. DeployGuard will register the checks automatically!
          </p>
          <div className="bg-[#0d1117] border border-[#21262d] rounded-xl p-4 mb-4 font-mono text-xs text-[#c9d1d9] space-y-1 select-all">
            <div>git checkout -b setup/deployguard</div>
            <div>git add .github/workflows/deployguard.yml</div>
            <div>git commit -m "ci: add DeployGuard bundle stats workflow"</div>
            <div>git push origin setup/deployguard</div>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            🎉 <strong>That's it!</strong> Once the Pull Request is open, you will see a pending DeployGuard check. It will evaluate and post detailed bundle explanations as soon as the CI build completes.
          </p>
        </div>
      )
    }
  ];

  const faqs = [
    {
      q: 'Why is the check stuck in "Waiting for Bundle Analysis CI…"?',
      a: 'DeployGuard received the PR event but the companion workflow hasn\'t finished or the artifact wasn\'t uploaded. Check the Actions tab in your repo — the job must be named "DeployGuard Bundle Stats" and upload an artifact named exactly "bundle-stats" containing a file called "stats.json".'
    },
    {
      q: 'Does my source code ever leave GitHub?',
      a: 'No. DeployGuard never downloads, clones, or reads your source code. The GitHub Action compiles inside your own runner and only uploads a metadata JSON file with file sizes and names. DeployGuard reads only that metadata.'
    },
    {
      q: 'What if the Groq AI service goes down?',
      a: 'DeployGuard degrades gracefully. Bundle size checks, check runs, and PR comments all still work. Only the AI-generated natural language explanation is skipped — a static fallback message is shown instead. Your gate status is never affected by AI availability.'
    },
    {
      q: 'My app is inside a subfolder (client/, frontend/, apps/web/…). Does it still work?',
      a: 'Yes — automatically. The workflow includes a "Detect frontend directory" step that scans common locations in order (root → client → frontend → src → apps/web → web → app → packages/web) and runs install + build in the right folder. No edits needed for the vast majority of project layouts. See the Structures tab for the full compatibility table.'
    },
    {
      q: 'How do I change regression thresholds?',
      a: 'Log into the DeployGuard dashboard with GitHub OAuth, select your repository, and go to Settings. You can adjust the maximum allowed bundle size increase (default ±10%), DB query count, and API p95 latency limits per repository.'
    },
    {
      q: 'How does the NLP commit classifier work?',
      a: 'Each commit message is run through a 3-tier pipeline: (1) a local SentenceTransformer model — fast, free, zero latency; (2) Groq Llama-3.1 if local confidence < 55%; (3) a graceful fallback to the best local guess if both are unavailable. This means classification never blocks your check run.'
    }
  ];

  const structures = [
    { layout: 'Standard Vite / CRA at root', dir: '.', detected: true },
    { layout: 'client/ + server/ split',      dir: 'client',      detected: true },
    { layout: 'frontend/ monolith',            dir: 'frontend',    detected: true },
    { layout: 'Turborepo apps/web/',           dir: 'apps/web',    detected: true },
    { layout: 'web/ or app/ directory',        dir: 'web / app',   detected: true },
    { layout: 'packages/web/ (npm workspaces)',dir: 'packages/web', detected: true },
    { layout: 'Next.js (.next/static output)', dir: '.',           detected: true },
    { layout: 'CRA (build/ output)',           dir: '.',           detected: true },
  ];

  const handleCopy = (code) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-[#0f1629] border border-[#1e2d4a]/85 rounded-2xl w-full max-w-[850px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-[scaleIn_0.25s_cubic-bezier(0.34,1.56,0.64,1)]">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-[#1e2d4a]/60 bg-[#070b14]/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🛡️</span>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">DeployGuard Integration Setup</h2>
              <p className="text-xs text-slate-400">Complete these simple steps to start monitoring performance</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer text-lg font-bold"
          >
            ✕
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#1e2d4a]/60 bg-[#070b14]/30 px-6">
          {[
            { key: 'steps',      label: '📖 Setup Guide' },
            { key: 'structures', label: '📁 Structures' },
            { key: 'faqs',       label: '❓ FAQs' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`py-3 px-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeTab === tab.key ? 'border-blue-500 text-blue-500' : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === 'steps' ? (
            <div className="space-y-6">
              
              {/* Stepper indicators */}
              <div className="flex items-center justify-between bg-[#070b14]/50 border border-[#1e2d4a]/40 rounded-xl p-3.5 mb-6">
                {steps.map((s, idx) => (
                  <div key={idx} className="flex items-center flex-1 last:flex-none">
                    <button
                      onClick={() => setActiveStep(idx)}
                      className={`flex items-center justify-center w-8 h-8 rounded-full border text-xs font-bold transition-all cursor-pointer ${
                        idx === activeStep 
                          ? 'bg-blue-600 border-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.4)]'
                          : idx < activeStep 
                          ? 'bg-green-500/10 border-green-500/40 text-green-500'
                          : 'bg-[#0f1629] border-[#1e2d4a] text-slate-400'
                      }`}
                    >
                      {idx < activeStep ? '✓' : idx + 1}
                    </button>
                    <span className={`ml-2 text-xs font-semibold ${idx === activeStep ? 'text-white' : 'text-slate-400'}`}>
                      {s.title.split(' ')[0]}
                    </span>
                    {idx < steps.length - 1 && (
                      <div className="flex-1 h-[2px] bg-[#1e2d4a]/40 mx-4" />
                    )}
                  </div>
                ))}
              </div>

              {/* Step Detail */}
              <div className="bg-[#070b14]/40 border border-[#1e2d4a]/60 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-xl">
                    {steps[activeStep].icon}
                  </div>
                  <h3 className="text-base font-bold text-white">{steps[activeStep].title}</h3>
                </div>

                {steps[activeStep].content}

                {/* Optional code box with Copy feature */}
                {steps[activeStep].code && (
                  <div className="mt-4">
                    <div className="flex items-center justify-between bg-[#0d1117] border-t border-x border-[#21262d] rounded-t-xl px-4 py-2 text-xs text-slate-400 font-mono">
                      <span>deployguard.yml</span>
                      <button
                        onClick={() => handleCopy(steps[activeStep].code)}
                        className="text-[11px] font-bold text-blue-500 hover:text-blue-400 transition-colors cursor-pointer"
                      >
                        {copied ? 'Copied!' : 'Copy Code'}
                      </button>
                    </div>
                    <div className="bg-[#0d1117] border border-[#21262d] rounded-b-xl p-4 overflow-x-auto max-h-[260px] shadow-inner">
                      <pre className="text-xs text-[#c9d1d9] font-mono leading-relaxed whitespace-pre">
                        <code>{steps[activeStep].code}</code>
                      </pre>
                    </div>
                  </div>
                )}
              </div>

            </div>
          ) : activeTab === 'structures' ? (
            <div>
              <p className="text-slate-300 text-sm mb-4">
                The workflow auto-detects your frontend directory — paste the same YAML into any of these project layouts and it will just work.
              </p>
              <div className="overflow-hidden rounded-xl border border-[#1e2d4a]/60">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#070b14]/60 text-slate-400 text-left">
                      <th className="px-4 py-3 font-semibold">Project layout</th>
                      <th className="px-4 py-3 font-semibold">Frontend dir</th>
                      <th className="px-4 py-3 font-semibold text-center">Auto-detected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {structures.map((s, i) => (
                      <tr key={i} className={`border-t border-[#1e2d4a]/30 ${i % 2 === 0 ? 'bg-transparent' : 'bg-[#070b14]/20'}`}>
                        <td className="px-4 py-3 text-slate-200">{s.layout}</td>
                        <td className="px-4 py-3 font-mono text-blue-400">{s.dir}</td>
                        <td className="px-4 py-3 text-center text-green-400">✅</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-500 mt-4 leading-relaxed">
                <strong className="text-slate-400">Custom layout?</strong> Add your frontend directory to the <code className="text-blue-400">for dir in …</code> list in the Detect step. The rest of the workflow adapts automatically.
              </p>
              <div className="mt-4 bg-[#070b14]/50 border border-[#1e2d4a]/40 rounded-xl p-4">
                <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-widest mb-2">Build output auto-discovery</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  After building, the stats generator checks <code className="text-blue-400">dist/</code>, <code className="text-blue-400">build/</code>, <code className="text-blue-400">out/</code>, and <code className="text-blue-400">.next/static</code> inside the detected frontend folder, then falls back to root-level dirs. It never exits with an error — if no bundle files are found, a placeholder <code className="text-blue-400">stats.json</code> is written so the upload step always succeeds.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {faqs.map((faq, idx) => (
                <div key={idx} className="border-b border-[#1e2d4a]/40 pb-5 last:border-0 last:pb-0">
                  <h3 className="text-sm font-bold text-white mb-2 flex items-start gap-2">
                    <span className="text-blue-500">Q:</span>
                    <span>{faq.q}</span>
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed pl-6">
                    {faq.a}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-[#1e2d4a]/60 bg-[#070b14]/50 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {activeTab === 'steps' ? `Step ${activeStep + 1} of 3` : 'Onboarding Documentation'}
          </div>
          <div className="flex gap-3">
            {activeTab === 'steps' && activeStep > 0 && (
              <button
                onClick={() => setActiveStep(activeStep - 1)}
                className="btn btn-ghost px-5 py-2 text-xs rounded-xl cursor-pointer"
              >
                Back
              </button>
            )}
            {activeTab === 'steps' && activeStep < steps.length - 1 ? (
              <button
                onClick={() => setActiveStep(activeStep + 1)}
                className="btn btn-primary px-5 py-2 text-xs rounded-xl cursor-pointer"
              >
                Next Step
              </button>
            ) : (
              <button
                onClick={onClose}
                className="btn btn-primary bg-green-600 hover:bg-green-500 px-6 py-2 text-xs rounded-xl shadow-[0_4px_12px_rgba(34,197,94,0.2)] cursor-pointer"
              >
                Go to Dashboard
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
