import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import Badge from './Badge';

export default function RepoCard({ repo, isMostActive = false }) {
  const lastCheck = repo.last_check;
  const timeAgo = lastCheck ? formatRelativeTime(new Date(lastCheck.created_at)) : 'Never checked';
  const setupStatus = repo.setup_status || 'pending';
  const needsSetup  = setupStatus !== 'merged';
  const status = lastCheck?.status;

  const topGlowLine = status === 'pass'
    ? 'bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500'
    : status === 'fail'
    ? 'bg-gradient-to-r from-rose-500 via-red-500 to-amber-500'
    : 'bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-500';

  const bundlerColors = {
    vite: 'bg-amber-950/40 text-amber-300 border-amber-500/30',
    nextjs: 'bg-slate-900 text-white border-slate-700',
    webpack: 'bg-cyan-950/40 text-cyan-300 border-cyan-500/30',
    cra: 'bg-sky-950/40 text-sky-300 border-sky-500/30',
  };

  const bundlerClass = bundlerColors[repo.build_tool?.toLowerCase()] || 'bg-white/[0.04] text-[#9CA3AF] border-white/[0.08]';

  return (
    <motion.div
      whileHover={{ y: -4, transition: { duration: 0.18, ease: 'easeOut' } }}
      whileTap={{ scale: 0.99 }}
      className="h-full"
    >
      <Link to={`/repo/${repo.owner}/${repo.name}`} className="no-underline block group h-full">
        <div
          className={`h-full bg-[#0D1017]/90 backdrop-blur-xl border rounded-xl p-5 transition-all duration-200 relative overflow-hidden flex flex-col justify-between ${
            isMostActive
              ? 'border-violet-500/50 shadow-[0_8px_30px_rgba(124,58,237,0.2)]'
              : 'border-white/[0.08] hover:border-violet-500/40 hover:shadow-[0_12px_36px_rgba(124,58,237,0.15)]'
          }`}
        >
          {/* Top hairline status gradient */}
          <div className={`absolute top-0 left-0 right-0 h-[2px] ${topGlowLine}`} />

          <div>
            {isMostActive && (
              <div className="absolute top-3 right-4 flex items-center gap-1.5 bg-violet-500/15 border border-violet-500/30 text-violet-300 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shadow-[0_0_10px_rgba(124,58,237,0.3)]">
                <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
                ACTIVE DEPLOY
              </div>
            )}

            {/* Setup status banner */}
            {needsSetup && (
              <div
                className={`flex items-center justify-between mb-3.5 px-3 py-1.5 rounded-lg text-xs font-mono border ${
                  setupStatus === 'pr_open'
                    ? 'bg-amber-950/30 border-amber-500/30 text-amber-300 shadow-[0_0_10px_rgba(245,158,11,0.1)]'
                    : 'bg-violet-950/30 border-violet-500/30 text-violet-300'
                }`}
              >
                <span className="truncate text-[11px]">
                  {setupStatus === 'pr_open'
                    ? '⚡ Setup PR ready — merge to activate'
                    : 'Awaiting setup workflow'}
                </span>
                {setupStatus === 'pr_open' && repo.setup_pr_url && (
                  <a
                    href={repo.setup_pr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="ml-2 font-semibold underline underline-offset-2 hover:text-white whitespace-nowrap text-[11px]"
                  >
                    View PR →
                  </a>
                )}
              </div>
            )}

            {/* Card Header */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-[#9CA3AF] font-mono truncate mb-0.5 flex items-center gap-1">
                  <span>{repo.owner}</span>
                  <span className="text-white/[0.3]">/</span>
                </div>
                <h3 className="text-base font-bold text-white group-hover:text-violet-300 transition-colors truncate tracking-tight">
                  {repo.name}
                </h3>
              </div>
              {!isMostActive && (
                <div className="flex-shrink-0 pt-0.5">
                  {lastCheck ? (
                    <Badge status={lastCheck.status} />
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 border border-white/[0.08] text-[#9CA3AF] rounded-full text-[10px] font-mono">
                      No checks
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* If Most Active, show badge below name */}
            {isMostActive && (
              <div className="mb-4">
                {lastCheck ? (
                  <Badge status={lastCheck.status} />
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 border border-white/[0.08] text-[#9CA3AF] rounded-full text-[10px] font-mono">
                    No checks
                  </span>
                )}
              </div>
            )}

            {/* Technical Metrics row */}
            <div className="grid grid-cols-3 gap-2 py-3 border-y border-white/[0.07] text-xs bg-white/[0.02] -mx-5 px-5">
              <div>
                <div className="text-[10px] text-[#9CA3AF] uppercase font-mono tracking-wider">
                  Bundle
                </div>
                <div className="font-mono text-xs font-semibold text-white mt-0.5">
                  {lastCheck?.results?.bundle_kb?.after ? (
                    <>
                      {lastCheck.results.bundle_kb.after} KB
                      {lastCheck.results.bundle_kb.delta != null && (
                        <span
                          className={`ml-1 text-[10px] font-bold ${
                            lastCheck.results.bundle_kb.delta > 0
                              ? 'text-rose-400'
                              : 'text-emerald-400'
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
                <div className="text-[10px] text-[#9CA3AF] uppercase font-mono tracking-wider">
                  PR Run
                </div>
                <div className="font-mono text-xs font-semibold text-cyan-300 mt-0.5">
                  {lastCheck ? `#${lastCheck.pr_number}` : '—'}
                </div>
              </div>

              <div>
                <div className="text-[10px] text-[#9CA3AF] uppercase font-mono tracking-wider">
                  Last CI
                </div>
                <div className="font-mono text-[11px] text-[#9CA3AF] mt-0.5 truncate">
                  {timeAgo}
                </div>
              </div>
            </div>
          </div>

          {/* Footer bundler pill & stats */}
          <div className="mt-3 pt-2 flex items-center justify-between text-xs text-[#9CA3AF]">
            <span className="text-[11px] font-mono">Bundler</span>
            {repo.build_tool && repo.build_tool !== 'unknown' ? (
              <span className={`font-mono uppercase text-[10px] font-bold px-2 py-0.5 rounded-md border ${bundlerClass}`}>
                {repo.build_tool}
              </span>
            ) : (
              <span className="font-mono text-[10px] text-[#9CA3AF]">AUTO-DETECT</span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function formatRelativeTime(date) {
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
