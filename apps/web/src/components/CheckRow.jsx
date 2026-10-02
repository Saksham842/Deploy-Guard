import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Badge from './Badge';

export default function CheckRow({ check, owner, name }) {
  const [expanded, setExpanded] = useState(false);
  const delta = check.results?.bundle_kb?.delta;
  const isPass = check.status === 'pass';
  const isFail = check.status === 'fail';

  const stripeColor = isPass
    ? '#10B981'
    : isFail
    ? '#F43F5E'
    : '#F59E0B';

  const deltaStr = delta != null
    ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`
    : '—';

  const deltaClass = delta != null
    ? delta > 0
      ? 'bg-rose-950/40 text-rose-400 border border-rose-500/30 font-bold'
      : 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 font-bold'
    : 'text-[#9CA3AF]';

  const date = new Date(check.created_at).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const causes = check.causes || [];
  const topCause = causes[0];

  return (
    <>
      <tr
        onClick={() => setExpanded(!expanded)}
        className="cursor-pointer transition-colors duration-150 hover:bg-white/[0.03] border-b border-white/[0.06]"
        style={{ borderLeft: `3px solid ${stripeColor}` }}
      >
        <td className="font-mono text-xs">
          <a
            href={`https://github.com/${owner}/${name}/pull/${check.pr_number}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-cyan-300 hover:text-white font-bold bg-cyan-950/30 hover:bg-cyan-900/40 px-2 py-0.5 rounded border border-cyan-500/30 transition-all inline-block"
          >
            #{check.pr_number}
          </a>
        </td>
        <td>
          <Badge status={check.status} />
        </td>
        <td>
          <span className={`font-mono text-xs px-2 py-0.5 rounded inline-block ${deltaClass}`}>
            {deltaStr}
          </span>
        </td>
        <td className="text-xs">
          {topCause ? (
            <span className="font-mono text-[#E5E7EB] bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.08]">
              {topCause.cause_type}
              <span className="text-[#9CA3AF] ml-1.5 font-sans">
                ({Math.round(topCause.confidence * 100)}%)
              </span>
            </span>
          ) : (
            <span className="text-[#9CA3AF] font-mono text-[11px]">—</span>
          )}
        </td>
        <td className="text-right font-mono text-[11px] text-[#9CA3AF]">
          <span className="mr-3">{date}</span>
          <motion.span
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
            className="inline-block text-violet-400 font-bold"
          >
            ›
          </motion.span>
        </td>
      </tr>

      {/* Smooth Spring Expanding Cause Details with Framer Motion */}
      <AnimatePresence>
        {expanded && (
          <tr>
            <td colSpan={5} className="p-0 border-b border-white/[0.08]">
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="bg-[#090B10] border-l-[3px] border-l-violet-500 px-5 py-4 text-xs space-y-3">
                  <div className="flex items-center gap-4 text-[#9CA3AF] font-mono text-[11px] flex-wrap">
                    <span>Head: <code className="text-white bg-white/[0.08] px-1.5 py-0.5 rounded">{check.head_sha?.slice(0, 7)}</code></span>
                    <span>Base: <code className="text-white bg-white/[0.08] px-1.5 py-0.5 rounded">{check.base_sha?.slice(0, 7)}</code></span>
                    {check.results?.bundle_kb && (
                      <span className="text-[#E5E7EB]">
                        Size: <strong className="text-white">{check.results.bundle_kb.after ?? '—'} KB</strong> (was {check.results.bundle_kb.before ?? '—'} KB)
                      </span>
                    )}
                  </div>

                  {causes.length > 0 ? (
                    <div className="space-y-1.5 pt-1 border-t border-white/[0.06]">
                      <div className="text-[10px] font-bold text-violet-400 uppercase tracking-wider">
                        Identified Regression Factors
                      </div>
                      {causes.map((c, i) => (
                        <div key={i} className="flex items-start gap-2 text-white">
                          <span className="font-mono text-amber-400 font-bold">•</span>
                          <span className="font-mono text-xs text-amber-300 bg-amber-950/30 px-1.5 py-0.5 rounded border border-amber-500/20">{c.cause_type}:</span>
                          <span className="text-[#9CA3AF]">{c.detail || 'Detected from commit heuristics and dependency diff'}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[#9CA3AF] italic text-[11px]">
                      No regression factors flagged for this check run.
                    </div>
                  )}
                </div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  );
}
