import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import MetricChart from '../components/MetricChart';
import CheckRow from '../components/CheckRow';
import Badge from '../components/Badge';

// Details page for a specific repository, showing stats cards, trend charts, and recent checks list.
export default function RepoDetail() {
  const { owner, name } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getRepoChecks(owner, name)
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [owner, name]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorBanner message={error} />;

  const { repo, checks } = data;
  const lastCheck = checks[0];
  const passRate = checks.length
    ? Math.round((checks.filter((c) => c.status === 'pass').length / checks.length) * 100)
    : null;

  return (
    <div className="fade-in">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm text-slate-400">
        <Link to="/dashboard" className="text-blue-500 no-underline hover:underline">Dashboard</Link>
        <span>/</span>
        <span>{owner}</span>
        <span>/</span>
        <span className="text-white font-semibold">{name}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-1 text-white">
            {owner}/<span className="text-blue-500">{name}</span>
          </h1>
          <div className="flex items-center gap-3">
            {lastCheck && <Badge status={lastCheck.status} />}
            <span className="text-slate-400 text-sm">
              Threshold: bundle ±{repo.threshold_config?.bundle_kb ?? 10}%
            </span>
          </div>
        </div>
        <div className="flex gap-3">
          <a
            href={`https://github.com/${owner}/${name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost"
          >
            View on GitHub →
          </a>
          <Link to={`/repo/${owner}/${name}/settings`} className="btn btn-ghost">⚙️ Settings</Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total Checks" value={checks.length} />
        <StatCard
          label="Pass Rate"
          value={passRate !== null ? `${passRate}%` : '—'}
          textColor={passRate >= 80 ? 'text-green-500' : passRate >= 50 ? 'text-yellow-500' : 'text-red-500'}
        />
        <StatCard label="Latest Bundle" value={lastCheck?.results?.bundle_kb?.after ? `${lastCheck.results.bundle_kb.after} KB` : '—'} />
        <StatCard label="Latest Delta" value={lastCheck?.results?.bundle_kb?.delta != null ? `${lastCheck.results.bundle_kb.delta > 0 ? '+' : ''}${lastCheck.results.bundle_kb.delta.toFixed(1)}%` : '—'} />
      </div>

      {/* Bundle trend chart */}
      <div className="card mb-6">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-base font-bold text-white">📦 Bundle Size Trend</h2>
          <span className="text-slate-400 text-xs">Last {checks.length} checks</span>
        </div>
        <MetricChart
          checks={checks}
          metric="bundle_kb"
          label="Bundle (KB)"
          threshold={lastCheck?.results?.bundle_kb?.before ? lastCheck.results.bundle_kb.before * (1 + (repo.threshold_config?.bundle_kb ?? 10) / 100) : undefined}
        />
      </div>

      {/* Checks table */}
      <div className="card">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-base font-bold text-white">🔍 Recent Checks</h2>
          <span className="text-slate-400 text-xs">Showing last {Math.min(checks.length, 10)}</span>
        </div>

        {checks.length === 0 ? (
          <p className="text-slate-400 text-center py-8">No checks yet — open a PR to trigger DeployGuard.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>PR</th>
                  <th>Status</th>
                  <th>Bundle Δ</th>
                  <th>NLP Cause</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {checks.slice(0, 10).map((c) => (
                  <CheckRow key={c.id} check={c} owner={owner} name={name} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, textColor }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className={`stat-value text-2xl font-extrabold mt-1 ${textColor || 'text-white'}`}>{value}</div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="fade-in">
      <div className="skeleton h-7 w-[30%] mb-8" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton h-20" />
        ))}
      </div>
      <div className="skeleton h-[300px] mb-6" />
      <div className="skeleton h-[200px]" />
    </div>
  );
}

function ErrorBanner({ message }) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-500">
      ⚠️ {message}
    </div>
  );
}
