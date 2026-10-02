import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '../api';
import MetricChart from '../components/MetricChart';
import CheckRow from '../components/CheckRow';
import Badge from '../components/Badge';
import AIReviewCard from '../components/AIReviewCard';
import GsapMagnetic from '../components/GsapMagnetic';

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
  const passCount = checks.filter((c) => c.status === 'pass').length;
  const passRate = checks.length
    ? Math.round((passCount / checks.length) * 100)
    : null;

  const bundleLimit = lastCheck?.results?.bundle_kb?.before
    ? Math.round(lastCheck.results.bundle_kb.before * (1 + (repo.threshold_config?.bundle_kb ?? 10) / 100))
    : undefined;

  const baselineValue = lastCheck?.results?.bundle_kb?.before ?? undefined;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Top Header / Breadcrumb & Actions */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-white/[0.08] pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[#9CA3AF] mb-1.5">
            <Link to="/dashboard" className="hover:text-violet-400 transition-colors">repos</Link>
            <span className="text-white/[0.3]">/</span>
            <span>{owner}</span>
            <span className="text-white/[0.3]">/</span>
            <span className="text-white font-bold">{name}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-white">
              {owner}/<span className="text-gradient-violet">{name}</span>
            </h1>
            {lastCheck && <Badge status={lastCheck.status} />}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <GsapMagnetic strength={0.25}>
            <Link
              to={`/repo/${owner}/${name}/settings`}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-white bg-white/[0.05] border border-white/[0.1] hover:bg-white/[0.1] hover:border-violet-500/40 transition-all cursor-pointer"
            >
              ⚙ Thresholds
            </Link>
          </GsapMagnetic>
          <GsapMagnetic strength={0.25}>
            <a
              href={`https://github.com/${owner}/${name}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 rounded-lg text-xs font-mono font-semibold text-cyan-300 bg-cyan-950/40 border border-cyan-500/30 hover:bg-cyan-900/40 hover:border-cyan-400/50 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>GitHub</span>
              <span>↗</span>
            </a>
          </GsapMagnetic>
        </div>
      </div>

      {/* Hero Content: Trendline Chart & Key Metric Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Core Stats in functional monospace */}
        <div className="lg:col-span-1 grid grid-cols-2 lg:grid-cols-1 gap-3">
          <div className="relative bg-[#0E1118]/85 backdrop-blur-xl border border-white/[0.08] rounded-xl p-4 transition-all duration-200 overflow-hidden hover:border-violet-500/40 hover:shadow-[0_8px_25px_rgba(124,58,237,0.15)]">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 to-indigo-500" />
            <div className="text-[10px] uppercase font-mono tracking-wider text-[#9CA3AF]">
              Latest Bundle Size
            </div>
            <div className="font-mono text-2xl font-black text-white mt-1">
              {lastCheck?.results?.bundle_kb?.after ? `${lastCheck.results.bundle_kb.after} KB` : '—'}
            </div>
            {lastCheck?.results?.bundle_kb?.delta != null && (
              <div
                className={`font-mono text-xs font-bold mt-1 inline-flex items-center px-1.5 py-0.5 rounded ${
                  lastCheck.results.bundle_kb.delta > 0
                    ? 'bg-rose-950/40 text-rose-400 border border-rose-500/30'
                    : 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30'
                }`}
              >
                {lastCheck.results.bundle_kb.delta > 0 ? '+' : ''}
                {lastCheck.results.bundle_kb.delta.toFixed(1)}% vs baseline
              </div>
            )}
          </div>

          <div className="relative bg-[#0E1118]/85 backdrop-blur-xl border border-white/[0.08] rounded-xl p-4 transition-all duration-200 overflow-hidden hover:border-emerald-500/40 hover:shadow-[0_8px_25px_rgba(16,185,129,0.15)]">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-emerald-400 to-teal-400" />
            <div className="text-[10px] uppercase font-mono tracking-wider text-[#9CA3AF]">
              Pass Rate ({checks.length} checks)
            </div>
            <div className="font-mono text-2xl font-black text-emerald-400 mt-1">
              {passRate !== null ? `${passRate}%` : '—'}
            </div>
            <div className="text-[11px] text-[#9CA3AF] mt-1 font-mono">
              <span className="text-emerald-400 font-bold">{passCount} passed</span> / {checks.length - passCount} failed
            </div>
          </div>

          <div className="relative bg-[#0E1118]/85 backdrop-blur-xl border border-white/[0.08] rounded-xl p-4 transition-all duration-200 overflow-hidden col-span-2 lg:col-span-1 hover:border-cyan-500/40 hover:shadow-[0_8px_25px_rgba(6,182,212,0.15)]">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-cyan-400 to-blue-500" />
            <div className="text-[10px] uppercase font-mono tracking-wider text-[#9CA3AF]">
              Active Budget Limit
            </div>
            <div className="font-mono text-xs font-semibold text-cyan-300 mt-1">
              ±{repo.threshold_config?.bundle_kb ?? 10}% bundle size tolerance
            </div>
            <div className="text-[11px] text-[#9CA3AF] mt-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span>{repo.threshold_config?.query_tracking_enabled ? 'Query count tracking ON' : 'Query tracking OFF'}</span>
            </div>
          </div>
        </div>

        {/* Hero Trend Chart */}
        <div className="lg:col-span-3 relative bg-[#0E1118]/85 backdrop-blur-xl border border-white/[0.08] rounded-xl p-5 overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400" />
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF] flex items-center gap-2">
              <span>📈</span>
              <span>Bundle Size Trend (KB)</span>
            </span>
            <span className="text-[11px] font-mono text-violet-300 bg-violet-950/40 px-2 py-0.5 rounded border border-violet-500/30">
              {checks.length} checks recorded
            </span>
          </div>
          <MetricChart
            checks={checks}
            metric="bundle_kb"
            label="Bundle"
            threshold={bundleLimit}
            baselineValue={baselineValue}
          />
        </div>
      </div>

      {/* Recent Checks Table */}
      <div className="bg-[#0E1118]/85 backdrop-blur-xl border border-white/[0.08] rounded-xl overflow-hidden shadow-xl">
        <div className="px-5 py-3.5 border-b border-white/[0.08] flex justify-between items-center bg-white/[0.02]">
          <h2 className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF] flex items-center gap-2">
            <span>⚡</span>
            <span>Check Execution History</span>
          </h2>
          <span className="text-[11px] font-mono text-[#9CA3AF]">
            Showing latest {Math.min(checks.length, 15)} runs
          </span>
        </div>

        {checks.length === 0 ? (
          <div className="py-14 text-center text-xs text-[#9CA3AF] font-mono">
            No checks yet — merge the setup PR to record your first production run.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-20">PR</th>
                  <th className="w-24">Status</th>
                  <th className="w-28">Bundle Δ</th>
                  <th>Primary Cause</th>
                  <th className="w-40 text-right">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {checks.slice(0, 15).map((c) => (
                  <CheckRow key={c.id} check={c} owner={owner} name={name} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AI Health Review */}
      <div>
        <AIReviewCard repoId={{ owner, name }} />
      </div>
    </motion.div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="skeleton h-8 w-1/3 mb-6" />
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="skeleton h-48 lg:col-span-1" />
        <div className="skeleton h-48 lg:col-span-3" />
      </div>
      <div className="skeleton h-64 w-full" />
    </div>
  );
}

function ErrorBanner({ message }) {
  return (
    <div className="bg-[rgba(240,96,90,0.08)] border border-[rgba(240,96,90,0.3)] rounded-lg p-4 text-[#F0605A] text-xs font-mono">
      ⚠️ Error: {message}
    </div>
  );
}
