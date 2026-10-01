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
  const totalChecks = repos.reduce((acc, r) => acc + (r.check_count || 0), 0);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.06,
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

      <div>
        {/* Header */}
        <div className="mb-6 pb-4 border-b border-[#252B32] flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[#E8EAED] mb-1">
              Repositories
            </h1>
            <p className="text-[#8B92A0] text-xs">
              Performance baseline monitoring across all connected GitHub repositories
            </p>
          </div>
          <GsapMagnetic strength={0.25}>
            <a
              href="https://github.com/apps/deployguard-saksham842"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary text-xs shadow-sm hover:shadow-[0_0_20px_rgba(76,141,255,0.25)]"
            >
              + Add repository
            </a>
          </GsapMagnetic>
        </div>

        {/* Stats row */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6"
        >
          <motion.div variants={itemVariants}>
            <StatCard label="Connected Repos" value={repos.length} />
          </motion.div>
          <motion.div variants={itemVariants}>
            <StatCard label="Passing Checks" value={passCount} color="green" />
          </motion.div>
          <motion.div variants={itemVariants}>
            <StatCard label="Failing Checks" value={failCount} color="red" />
          </motion.div>
          <motion.div variants={itemVariants}>
            <StatCard label="Total Checks" value={totalChecks} />
          </motion.div>
        </motion.div>

        {/* Repos grid */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-[#161A1F] border border-[#252B32] rounded-lg p-4">
                <div className="skeleton h-4 w-3/5 rounded mb-3" />
                <div className="skeleton h-3 w-2/5 rounded mb-2" />
                <div className="skeleton h-3 w-4/5 rounded" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="bg-[rgba(240,96,90,0.08)] border border-[rgba(240,96,90,0.3)] rounded-lg p-4 text-[#F0605A] text-xs font-mono">
            ⚠️ {error}
          </div>
        )}

        {!loading && !error && repos.length === 0 && (
          <EmptyState />
        )}

        {!loading && repos.length > 0 && (() => {
          const sorted = [...repos].sort((a, b) => {
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
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3"
            >
              {sorted.map(repo => (
                <motion.div key={repo.id} variants={itemVariants} className="h-full">
                  <RepoCard
                    repo={repo}
                    isMostActive={repo.id === mostActiveId && Boolean(repo.last_check)}
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

function StatCard({ label, value, color }) {
  const valueColor = color === 'green' ? 'text-[#3DD68C]' : color === 'red' ? 'text-[#F0605A]' : 'text-[#E8EAED]';

  return (
    <div className="bg-[#161A1F] border border-[#252B32] rounded-lg p-3.5 transition-colors hover:border-[#38424E]">
      <div className="text-[10px] font-mono font-semibold text-[#8B92A0] tracking-wider uppercase">
        {label}
      </div>
      <div className={`text-2xl font-mono font-bold mt-1 ${valueColor}`}>
        {value}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="text-center py-14 px-4 bg-[#161A1F] border border-[#252B32] rounded-lg max-w-md mx-auto"
    >
      <h2 className="text-sm font-semibold text-[#E8EAED] mb-1">No repositories connected yet</h2>
      <p className="text-xs text-[#8B92A0] mb-5 max-w-[320px] mx-auto leading-relaxed">
        Install the DeployGuard GitHub App on your repositories to enable automated setup PRs and performance tracking.
      </p>
      <GsapMagnetic strength={0.3}>
        <a
          href="https://github.com/apps/deployguard-saksham842"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary text-xs shadow-sm hover:shadow-[0_0_20px_rgba(76,141,255,0.25)]"
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
