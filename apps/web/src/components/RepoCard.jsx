import { Link } from 'react-router-dom';
import Badge from './Badge';

export default function RepoCard({ repo, isMostActive = false }) {
  const lastCheck = repo.last_check;
  const timeAgo = lastCheck ? formatRelativeTime(new Date(lastCheck.created_at)) : 'Never checked';
  const setupStatus = repo.setup_status || 'pending';
  const needsSetup  = setupStatus !== 'merged';

  return (
    <Link to={`/repo/${repo.owner}/${repo.name}`} className="no-underline block group">
      <div
        className={`bg-[#161A1F] border rounded-lg p-4 transition-colors duration-150 relative ${
          isMostActive
            ? 'border-[#4C8DFF]/50 bg-[#161A1F]'
            : 'border-[#252B32] hover:border-[#38424E]'
        }`}
      >
        {isMostActive && (
          <div className="absolute -top-2.5 right-3 bg-[#4C8DFF] text-[#0D0F12] text-[10px] font-mono font-bold px-2 py-0.5 rounded tracking-wide uppercase">
            Active
          </div>
        )}

        {/* Setup status banner */}
        {needsSetup && (
          <div
            className={`flex items-center justify-between mb-3 px-2.5 py-1.5 rounded text-xs font-mono border ${
              setupStatus === 'pr_open'
                ? 'bg-[rgba(245,166,35,0.08)] border-[rgba(245,166,35,0.25)] text-[#F5A623]'
                : 'bg-[rgba(76,141,255,0.08)] border-[rgba(76,141,255,0.25)] text-[#4C8DFF]'
            }`}
          >
            <span className="truncate">
              {setupStatus === 'pr_open'
                ? 'Setup PR ready — merge to activate'
                : 'Awaiting setup workflow'}
            </span>
            {setupStatus === 'pr_open' && repo.setup_pr_url && (
              <a
                href={repo.setup_pr_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={e => e.stopPropagation()}
                className="ml-2 underline underline-offset-2 hover:text-white whitespace-nowrap"
              >
                View setup PR →
              </a>
            )}
          </div>
        )}

        {/* Card Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs text-[#8B92A0] font-mono truncate mb-0.5">
              {repo.owner} /
            </div>
            <h3 className="text-sm font-semibold text-[#E8EAED] group-hover:text-[#4C8DFF] transition-colors truncate">
              {repo.name}
            </h3>
          </div>
          <div className="flex-shrink-0">
            {lastCheck ? (
              <Badge status={lastCheck.status} />
            ) : (
              <span className="inline-flex items-center px-2 py-0.5 border border-[#252B32] text-[#8B92A0] rounded text-[10px] font-mono">
                No checks yet
              </span>
            )}
          </div>
        </div>

        {/* Technical Metrics row */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#1B2026] text-xs">
          <div>
            <div className="text-[10px] text-[#8B92A0] uppercase tracking-wide">
              Bundle
            </div>
            <div className="font-mono text-xs text-[#E8EAED] mt-0.5">
              {lastCheck?.results?.bundle_kb?.after ? (
                <>
                  {lastCheck.results.bundle_kb.after} KB
                  {lastCheck.results.bundle_kb.delta != null && (
                    <span
                      className={`ml-1 text-[11px] ${
                        lastCheck.results.bundle_kb.delta > 0
                          ? 'text-[#F0605A]'
                          : 'text-[#3DD68C]'
                      }`}
                    >
                      {lastCheck.results.bundle_kb.delta > 0 ? '+' : ''}
                      {lastCheck.results.bundle_kb.delta.toFixed(1)}%
                    </span>
                  )}
                </>
              ) : (
                '—'
              )}
            </div>
          </div>

          <div>
            <div className="text-[10px] text-[#8B92A0] uppercase tracking-wide">
              PR
            </div>
            <div className="font-mono text-xs text-[#E8EAED] mt-0.5">
              {lastCheck ? `#${lastCheck.pr_number}` : '—'}
            </div>
          </div>

          <div>
            <div className="text-[10px] text-[#8B92A0] uppercase tracking-wide">
              Checked
            </div>
            <div className="font-mono text-xs text-[#8B92A0] mt-0.5 truncate">
              {timeAgo}
            </div>
          </div>
        </div>

        {repo.build_tool && repo.build_tool !== 'unknown' && (
          <div className="mt-2.5 pt-2 border-t border-[#1B2026] flex items-center justify-between text-[11px] text-[#8B92A0]">
            <span>Bundler</span>
            <span className="font-mono text-[#E8EAED] uppercase text-[10px] bg-[#0D0F12] px-1.5 py-0.5 rounded border border-[#252B32]">
              {repo.build_tool}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

function formatRelativeTime(date) {
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
