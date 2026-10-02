import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../api';
import RepoCard from '../components/RepoCard';
import GsapMagnetic from '../components/GsapMagnetic';

export default function Dashboard() {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveFilterTab] = useState('all');

  useEffect(() => {
    api.getRepos()
      .then(data => { setRepos(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

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
