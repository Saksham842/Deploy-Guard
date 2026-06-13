import { Link } from 'react-router-dom';
import Badge from './Badge';

export default function RepoCard({ repo }) {
  const lastCheck = repo.last_check;
  const timeAgo = lastCheck ? formatRelativeTime(new Date(lastCheck.created_at)) : 'Never checked';

  return (
    <Link to={`/repo/${repo.owner}/${repo.name}`} className="no-underline block">
      <div className="bg-[#0f1629]/75 border border-[#1e2d4a]/80 hover:border-blue-500/80 rounded-xl p-5 hover:shadow-[0_8px_30px_rgb(0,0,0,0.4)] transition-all duration-200 hover:-translate-y-0.5 cursor-pointer backdrop-blur-sm">
        
        {/* Card Header */}
        <div className="flex items-start justify-between gap-4 mb-3.5">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-base flex-shrink-0">📦</span>
              <span className="text-xs text-slate-400 font-medium truncate">
                {repo.owner} /
              </span>
            </div>
            <h3 className="text-lg font-bold text-white truncate">
              {repo.name}
            </h3>
          </div>
          <div className="flex-shrink-0">
            {lastCheck ? (
              <Badge status={lastCheck.status} />
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 rounded-full text-xs font-semibold tracking-wider whitespace-nowrap">
                No checks yet
              </span>
            )}
          </div>
        </div>

        {/* Metrics/Info row */}
        <div className="flex gap-6 mt-4">
          {lastCheck?.results?.bundle_kb && (
            <Metric
              label="Bundle"
              value={`${lastCheck.results.bundle_kb.after} KB`}
              delta={lastCheck.results.bundle_kb.delta}
            />
          )}
          <div>
            <div className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase mb-0.5">
              Last check
            </div>
            <div className="text-xs text-slate-400 font-medium">
              {timeAgo}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase mb-0.5">
              PR
            </div>
            <div className="text-xs text-slate-400 font-medium">
              {lastCheck ? `#${lastCheck.pr_number}` : '—'}
            </div>
          </div>
        </div>

      </div>
    </Link>
  );
}

function Metric({ label, value, delta }) {
  const isPositive = delta > 0;
  // Negative delta = bundle shrank = always green.
  // Positive delta: green ≤5%, yellow 5-10%, red >10%.
  const deltaColorClass = !isPositive
    ? 'text-green-500'
    : delta > 10
    ? 'text-red-500'
    : delta > 5
    ? 'text-yellow-500'
    : 'text-green-500';

  return (
    <div>
      <div className="text-[10px] text-slate-500 font-semibold tracking-wider uppercase mb-0.5">
        {label}
      </div>
      <div className="text-sm font-bold text-white flex items-center">
        {value}
        {delta !== undefined && delta !== null && (
          <span className={`ml-2 text-xs font-semibold ${deltaColorClass}`}>
            {isPositive ? '+' : ''}{delta.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

function formatRelativeTime(date) {
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
