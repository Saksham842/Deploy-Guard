import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import MetricChart from '../components/MetricChart';
import CheckRow from '../components/CheckRow';
import Badge from '../components/Badge';
import AIReviewCard from '../components/AIReviewCard';

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
    <div className="space-y-6">
      {/* Top Header / Breadcrumb & Actions */}
      <div className="flex items-center justify-between flex-wrap gap-4 border-b border-[#252B32] pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-[#8B92A0] mb-1">
            <Link to="/dashboard" className="hover:text-[#4C8DFF]">repos</Link>
            <span>/</span>
            <span>{owner}</span>
            <span>/</span>
            <span className="text-[#E8EAED] font-semibold">{name}</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-[#E8EAED]">
              {owner}/<span className="text-[#4C8DFF]">{name}</span>
            </h1>
            {lastCheck && <Badge status={lastCheck.status} />}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/repo/${owner}/${name}/settings`}
            className="btn btn-ghost text-xs"
          >
            Configure thresholds
          </Link>
          <a
            href={`https://github.com/${owner}/${name}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost text-xs font-mono"
          >
            GitHub ↗
          </a>
        </div>
      </div>

      {/* Hero Content: The Trendline Chart & Key Deltas lead above the fold */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Core Stats in functional monospace */}
        <div className="lg:col-span-1 grid grid-cols-2 lg:grid-cols-1 gap-3">
          <div className="bg-[#161A1F] border border-[#252B32] rounded-lg p-3.5">
            <div className="text-[10px] uppercase font-mono tracking-wider text-[#8B92A0]">
              Latest Bundle Size
            </div>
            <div className="font-mono text-xl font-bold text-[#E8EAED] mt-1">
              {lastCheck?.results?.bundle_kb?.after ? `${lastCheck.results.bundle_kb.after} KB` : '—'}
            </div>
            {lastCheck?.results?.bundle_kb?.delta != null && (
              <div
                className={`font-mono text-xs font-semibold mt-0.5 ${
                  lastCheck.results.bundle_kb.delta > 0
                    ? lastCheck.results.bundle_kb.delta > 10
                      ? 'text-[#F0605A]'
                      : 'text-[#F5A623]'
                    : 'text-[#3DD68C]'
                }`}
              >
                {lastCheck.results.bundle_kb.delta > 0 ? '+' : ''}
                {lastCheck.results.bundle_kb.delta.toFixed(1)}% vs baseline
              </div>
            )}
          </div>

          <div className="bg-[#161A1F] border border-[#252B32] rounded-lg p-3.5">
            <div className="text-[10px] uppercase font-mono tracking-wider text-[#8B92A0]">
              Pass Rate ({checks.length} checks)
            </div>
            <div className="font-mono text-xl font-bold text-[#E8EAED] mt-1">
              {passRate !== null ? `${passRate}%` : '—'}
            </div>
            <div className="text-[11px] text-[#8B92A0] mt-0.5">
              {passCount} passed / {checks.length - passCount} failed
            </div>
          </div>

          <div className="bg-[#161A1F] border border-[#252B32] rounded-lg p-3.5 col-span-2 lg:col-span-1">
            <div className="text-[10px] uppercase font-mono tracking-wider text-[#8B92A0]">
              Active Threshold
            </div>
            <div className="font-mono text-xs text-[#E8EAED] mt-1">
              ±{repo.threshold_config?.bundle_kb ?? 10}% bundle limit
            </div>
            <div className="text-[11px] text-[#8B92A0] mt-0.5">
              {repo.threshold_config?.query_tracking_enabled ? 'Query count tracking on' : 'Query tracking off'}
            </div>
          </div>
        </div>

        {/* Hero Trend Chart */}
        <div className="lg:col-span-3 bg-[#161A1F] border border-[#252B32] rounded-lg p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#8B92A0]">
              Bundle Size Trend (KB)
            </span>
            <span className="text-[11px] font-mono text-[#8B92A0]">
              {checks.length} checks tracked
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
      <div className="bg-[#161A1F] border border-[#252B32] rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#252B32] flex justify-between items-center">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#8B92A0]">
            Check History
          </h2>
          <span className="text-[11px] font-mono text-[#8B92A0]">
            Showing latest {Math.min(checks.length, 15)}
          </span>
        </div>

        {checks.length === 0 ? (
          <div className="py-12 text-center text-xs text-[#8B92A0] font-mono">
            No checks yet — merge the setup PR to run your first check.
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
    </div>
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
