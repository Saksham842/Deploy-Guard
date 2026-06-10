import { useState, useEffect } from 'react';
import { api } from '../api';
import RepoCard from '../components/RepoCard';

export default function Dashboard() {
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getRepos()
      .then(data => { setRepos(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  const passCount = repos.filter(r => r.last_check?.status === 'pass').length;
  const failCount = repos.filter(r => r.last_check?.status === 'fail').length;
  const totalChecks = repos.reduce((acc, r) => acc + (r.check_count || 0), 0);

  return (
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
