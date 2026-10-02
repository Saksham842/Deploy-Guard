import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';
import RepoCard from '../components/RepoCard';
import GsapMagnetic from '../components/GsapMagnetic';
import { useSearchParams } from 'react-router-dom';

export default function Dashboard() {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveFilterTab] = useState('all');

  useEffect(() => {
    api.getRepos()
      .then(data => { setRepos(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });

    // Only open setup modal when explicitly requested (?setup=true)
    const forceSetup = searchParams.get('setup') === 'true';
    setShowOnboarding(forceSetup);
  }, [searchParams]);

  const passCount = repos.filter(r => r.last_check?.status === 'pass').length;
  const failCount = repos.filter(r => r.last_check?.status === 'fail').length;
  const needsSetupCount = repos.filter(r => r.setup_status !== 'merged').length;
  const totalChecks = repos.reduce((acc, r) => acc + (r.check_count || 0), 0);

  // Filter repos based on tab and query
  const filteredRepos = repos.filter(repo => {
    const matchesSearch = repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          repo.owner.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (activeTab === 'passing') return repo.last_check?.status === 'pass';
    if (activeTab === 'failing') return repo.last_check?.status === 'fail';
    if (activeTab === 'setup') return repo.setup_status !== 'merged';
    return true;
  });

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <>
      <AnimatePresence>
        {showOnboarding && (
          <OnboardingModal
            onClose={() => {
              setShowOnboarding(false);
              setSearchParams({}); // Clear ?setup=true from URL
            }}
          />
        )}
      </AnimatePresence>

      <div className="space-y-6">
        {/* Render Header */}
        <div className="pb-5 border-b border-white/[0.08] flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <h1 className="text-2xl font-black tracking-tight text-white">
                Workspaces & Repositories
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300 text-xs font-mono font-bold">
                {repos.length} Active
              </span>
            </div>
            <p className="text-[#9CA3AF] text-xs">
              Continuous performance baseline monitoring and regression quality gates
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowOnboarding(true)}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 hover:bg-cyan-900/40 hover:border-cyan-400/50 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>⚡</span>
              <span>CI Guide</span>
            </button>
            <GsapMagnetic strength={0.25}>
              <a
                href="https://github.com/apps/deployguard-saksham842"
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary text-xs shadow-lg hover:shadow-[0_0_25px_rgba(124,58,237,0.5)] cursor-pointer"
              >
                + Connect Repository
              </a>
            </GsapMagnetic>
          </div>
        </div>

        {/* Render-style Colorful Stat cards */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <motion.div variants={itemVariants}>
            <StatCard label="Connected Repos" value={repos.length} color="violet" icon="📦" />
          </motion.div>
          <motion.div variants={itemVariants}>
            <StatCard label="Passing Checks" value={passCount} color="green" icon="🟢" />
          </motion.div>
          <motion.div variants={itemVariants}>
            <StatCard label="Failing Checks" value={failCount} color="red" icon="🔴" />
          </motion.div>
          <motion.div variants={itemVariants}>
            <StatCard label="Total Checks Run" value={totalChecks} color="cyan" icon="⚡" />
          </motion.div>
        </motion.div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          {/* Quick tab filters */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs">
            <button
              onClick={() => setActiveFilterTab('all')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-[#9CA3AF] hover:text-white'
              }`}
            >
              All ({repos.length})
            </button>
            <button
              onClick={() => setActiveFilterTab('passing')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === 'passing'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-[#9CA3AF] hover:text-emerald-400'
              }`}
            >
              Passing ({passCount})
            </button>
            <button
              onClick={() => setActiveFilterTab('failing')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === 'failing'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-[#9CA3AF] hover:text-rose-400'
              }`}
            >
              Failing ({failCount})
            </button>
            <button
              onClick={() => setActiveFilterTab('setup')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all cursor-pointer ${
                activeTab === 'setup'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-[#9CA3AF] hover:text-amber-400'
              }`}
            >
              Setup ({needsSetupCount})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative max-w-xs w-full">
            <input
              type="text"
              placeholder="Filter repositories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input pr-8 text-xs font-mono"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Repos grid */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-[#0E1118]/80 border border-white/[0.08] rounded-xl p-5">
                <div className="skeleton h-4 w-3/5 rounded mb-3" />
                <div className="skeleton h-3 w-2/5 rounded mb-2" />
                <div className="skeleton h-12 w-full rounded" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-4 text-rose-300 text-xs font-mono shadow-[0_0_20px_rgba(244,63,94,0.1)]">
            ⚠️ {error}
          </div>
        )}

        {!loading && !error && filteredRepos.length === 0 && (
          <EmptyState isSearch={Boolean(searchQuery) || activeTab !== 'all'} />
        )}

        {!loading && filteredRepos.length > 0 && (() => {
          const sorted = [...filteredRepos].sort((a, b) => {
            const aTime = a.last_check ? new Date(a.last_check.created_at).getTime() : 0;
            const bTime = b.last_check ? new Date(b.last_check.created_at).getTime() : 0;
            return bTime - aTime;
          });
          const mostActiveId = sorted[0]?.id;

          return (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            >
              {sorted.map(repo => (
                <motion.div key={repo.id} variants={itemVariants} className="h-full">
                  <RepoCard
                    repo={repo}
                    isMostActive={repo.id === mostActiveId && Boolean(repo.last_check) && activeTab === 'all' && !searchQuery}
                  />
                </motion.div>
              ))}
            </motion.div>
          );
        })()}
      </div>
    </>
  );
}

function StatCard({ label, value, color, icon }) {
  const configs = {
    violet: {
      border: 'hover:border-violet-500/40',
      gradient: 'from-violet-500 via-indigo-500 to-cyan-400',
      text: 'text-violet-300',
      glow: 'hover:shadow-[0_8px_25px_rgba(124,58,237,0.2)]',
    },
    green: {
      border: 'hover:border-emerald-500/40',
      gradient: 'from-emerald-400 via-teal-400 to-cyan-400',
      text: 'text-emerald-400',
      glow: 'hover:shadow-[0_8px_25px_rgba(16,185,129,0.2)]',
    },
    red: {
      border: 'hover:border-rose-500/40',
      gradient: 'from-rose-500 via-pink-500 to-amber-500',
      text: 'text-rose-400',
      glow: 'hover:shadow-[0_8px_25px_rgba(244,63,94,0.2)]',
    },
    cyan: {
      border: 'hover:border-cyan-500/40',
      gradient: 'from-cyan-400 via-blue-500 to-indigo-500',
      text: 'text-cyan-300',
      glow: 'hover:shadow-[0_8px_25px_rgba(6,182,212,0.2)]',
    },
  };

  const cfg = configs[color] || configs.violet;

  return (
    <div className={`relative bg-[#0E1118]/85 backdrop-blur-xl border border-white/[0.08] rounded-xl p-4 transition-all duration-200 overflow-hidden ${cfg.border} ${cfg.glow}`}>
      <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r ${cfg.gradient}`} />
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-mono font-medium text-[#9CA3AF] tracking-wider uppercase">
          {label}
        </div>
        <span className="text-xs opacity-75">{icon}</span>
      </div>
      <div className={`text-3xl font-mono font-black mt-2 tracking-tight ${cfg.text}`}>
        {value}
      </div>
    </div>
  );
}

function EmptyState({ isSearch }) {
  if (isSearch) {
    return (
      <div className="text-center py-14 px-4 bg-[#0E1118]/70 border border-white/[0.08] rounded-xl max-w-md mx-auto">
        <div className="text-2xl mb-2">🔍</div>
        <h2 className="text-sm font-bold text-white mb-1">No repositories match your filter</h2>
        <p className="text-xs text-[#9CA3AF]">Try clearing your search query or selecting a different tab filter.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="text-center py-16 px-6 bg-[#0E1118]/85 backdrop-blur-xl border border-white/[0.08] rounded-2xl max-w-lg mx-auto shadow-2xl relative overflow-hidden"
    >
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400" />
      <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/25 flex items-center justify-center mx-auto mb-4 text-2xl shadow-[0_0_20px_rgba(124,58,237,0.3)]">
        🛡️
      </div>
      <h2 className="text-base font-bold text-white mb-1">No repositories connected yet</h2>
      <p className="text-xs text-[#9CA3AF] mb-6 max-w-[360px] mx-auto leading-relaxed">
        Install the DeployGuard GitHub App on your repositories. DeployGuard will automatically detect your bundler and open a setup PR.
      </p>
      <GsapMagnetic strength={0.3}>
        <a
          href="https://github.com/apps/deployguard-saksham842"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary text-xs shadow-lg hover:shadow-[0_0_25px_rgba(124,58,237,0.5)] cursor-pointer"
        >
          Install GitHub App →
        </a>
      </GsapMagnetic>
    </motion.div>
  );
}

function OnboardingModal({ onClose }) {
  const [activeTab, setActiveTab] = useState('flow'); // 'flow' | 'manual' | 'faqs'
  const [copied, setCopied] = useState(false);

  const manualYaml = `name: DeployGuard Bundle Stats

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
            fs.mkdirSync('dist', { recursive: true });
            fs.writeFileSync('dist/stats.json', JSON.stringify({ format: 'vite', assets }));
          "

      - name: Upload bundle-stats
        uses: actions/upload-artifact@v4
        with:
          name: bundle-stats
          path: dist/stats.json
          retention-days: 7`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0D0F12]/80 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="bg-[#161A1F] border border-[#252B32] rounded-lg max-w-xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl"
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#252B32] flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#E8EAED]">
              DeployGuard Integration Guide
            </h2>
            <p className="text-[11px] text-[#8B92A0] mt-0.5">
              Automated onboarding workflow and manual CI configuration
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[#8B92A0] hover:text-[#E8EAED] text-base font-mono cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-[#252B32] px-5 text-xs font-mono">
          <button
            onClick={() => setActiveTab('flow')}
            className={`py-2.5 px-3 border-b-2 font-medium transition-colors cursor-pointer ${
              activeTab === 'flow'
                ? 'border-[#4C8DFF] text-[#E8EAED]'
                : 'border-transparent text-[#8B92A0] hover:text-[#E8EAED]'
            }`}
          >
            Automated Setup (Recommended)
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`py-2.5 px-3 border-b-2 font-medium transition-colors cursor-pointer ${
              activeTab === 'manual'
                ? 'border-[#4C8DFF] text-[#E8EAED]'
                : 'border-transparent text-[#8B92A0] hover:text-[#E8EAED]'
            }`}
          >
            Manual YAML Template
          </button>
          <button
            onClick={() => setActiveTab('faqs')}
            className={`py-2.5 px-3 border-b-2 font-medium transition-colors cursor-pointer ${
              activeTab === 'faqs'
                ? 'border-[#4C8DFF] text-[#E8EAED]'
                : 'border-transparent text-[#8B92A0] hover:text-[#E8EAED]'
            }`}
          >
            FAQs
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {activeTab === 'flow' && (
            <div className="space-y-4">
              <div className="bg-[#0D0F12] border border-[#252B32] rounded p-3 text-[11px] text-[#3DD68C] font-mono">
                ✓ Zero copy-paste needed: DeployGuard auto-detects Vite, Next.js, and Webpack and generates a pull request automatically.
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <span className="font-mono text-xs text-[#4C8DFF] bg-[#252B32] px-1.5 py-0.5 rounded">1</span>
                  <div>
                    <div className="font-semibold text-[#E8EAED]">Install the GitHub App</div>
                    <div className="text-[#8B92A0] text-[11px] mt-0.5">
                      Grant DeployGuard access to your repository on GitHub.
                    </div>
                    <a
                      href="https://github.com/apps/deployguard-saksham842"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block mt-2 text-[#4C8DFF] underline text-[11px]"
                    >
                      Open GitHub App installation page ↗
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3 pt-2 border-t border-[#252B32]">
                  <span className="font-mono text-xs text-[#4C8DFF] bg-[#252B32] px-1.5 py-0.5 rounded">2</span>
                  <div>
                    <div className="font-semibold text-[#E8EAED]">Merge the Automated Setup PR</div>
                    <div className="text-[#8B92A0] text-[11px] mt-0.5">
                      DeployGuard scans your <code className="text-[#E8EAED]">package.json</code>, identifies your bundler, commits <code className="text-[#E8EAED]">.github/workflows/deployguard.yml</code> to branch <code className="text-[#E8EAED]">deployguard/setup</code>, and opens a PR for you to review and merge.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3 pt-2 border-t border-[#252B32]">
                  <span className="font-mono text-xs text-[#4C8DFF] bg-[#252B32] px-1.5 py-0.5 rounded">3</span>
                  <div>
                    <div className="font-semibold text-[#E8EAED]">Performance Gate is Live</div>
                    <div className="text-[#8B92A0] text-[11px] mt-0.5">
                      Once merged, every subsequent PR will upload build stats, trigger regression checks, and receive AI-annotated reports.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'manual' && (
            <div className="space-y-3">
              <div className="text-[#8B92A0] text-[11px]">
                If your repo already has an existing workflow or uses custom CI paths, add this file at <code className="text-[#E8EAED] font-mono">.github/workflows/deployguard.yml</code>:
              </div>
              <div className="relative">
                <pre className="bg-[#0D0F12] border border-[#252B32] rounded p-3 text-[11px] font-mono text-[#E8EAED] overflow-x-auto leading-relaxed max-h-60">
                  {manualYaml}
                </pre>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(manualYaml);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="absolute top-2 right-2 px-2 py-1 bg-[#252B32] hover:bg-[#38424E] text-[#E8EAED] rounded text-[10px] font-mono cursor-pointer"
                >
                  {copied ? 'Copied!' : 'Copy YAML'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'faqs' && (
            <div className="space-y-3 text-[11px]">
              <div>
                <div className="font-semibold text-[#E8EAED] mb-0.5">Does source code leave my GitHub runner?</div>
                <div className="text-[#8B92A0]">No. The CI runner compiles inside your own container and only uploads a lightweight <code className="text-[#E8EAED]">stats.json</code> file size dictionary.</div>
              </div>
              <div className="pt-2 border-t border-[#252B32]">
                <div className="font-semibold text-[#E8EAED] mb-0.5">Which bundlers are supported?</div>
                <div className="text-[#8B92A0]">Vite, Next.js, native Webpack, and Create React App.</div>
              </div>
              <div className="pt-2 border-t border-[#252B32]">
                <div className="font-semibold text-[#E8EAED] mb-0.5">How do I track database queries?</div>
                <div className="text-[#8B92A0]">Tenant test harnesses output <code className="text-[#E8EAED]">dist/query-stats.json</code> with <code className="text-[#E8EAED]">&#123; queryCount: 42 &#125;</code> into the same artifact.</div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-[#252B32] flex justify-end">
          <button
            onClick={onClose}
            className="btn btn-ghost text-xs"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
