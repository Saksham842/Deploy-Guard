import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Badge from './Badge';

export default function CheckRow({ check, owner, name }) {
  const [expanded, setExpanded] = useState(false);
  const delta = check.results?.bundle_kb?.delta;
  const isPass = check.status === 'pass';
  const isFail = check.status === 'fail';

  const stripeColor = isPass
    ? '#3DD68C'
    : isFail
    ? '#F0605A'
    : '#F5A623';

  const deltaStr = delta != null
    ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%`
    : '—';

  const deltaClass = delta != null
    ? delta > 0
      ? delta > 10
        ? 'text-[#F0605A]'
        : 'text-[#F5A623]'
      : 'text-[#3DD68C]'
    : 'text-[#8B92A0]';

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
        className="cursor-pointer transition-colors duration-150 hover:bg-[#1C2128]"
        style={{ borderLeft: `3px solid ${stripeColor}` }}
      >
        <td className="font-mono text-xs">
          <a
            href={`https://github.com/${owner}/${name}/pull/${check.pr_number}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[#4C8DFF] hover:underline"
          >
            #{check.pr_number}
          </a>
        </td>
        <td>
          <Badge status={check.status} />
        </td>
        <td className={`font-mono text-xs font-semibold ${deltaClass}`}>
          {deltaStr}
        </td>
        <td className="text-xs">
          {topCause ? (
            <span className="font-mono text-[#8B92A0]">
              {topCause.cause_type}
              <span className="text-[#57606A] ml-1.5 font-sans">
                ({Math.round(topCause.confidence * 100)}%)
              </span>
            </span>
          ) : (
            <span className="text-[#57606A]">—</span>
          )}
        </td>
        <td className="text-right font-mono text-[11px] text-[#8B92A0]">
          <span className="mr-3">{date}</span>
          <motion.span
            animate={{ rotate: expanded ? 90 : 0 }}
            transition={{ duration: 0.2 }}
            className="inline-block text-[#57606A]"
          >
            ›
          </motion.span>
        </td>
      </tr>

      {/* Smooth Spring Expanding Cause Details with Framer Motion */}
      <AnimatePresence>
        {expanded && (
          <tr>
            <td colSpan={5} className="p-0 border-b border-[#1B2026]">
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <div className="bg-[#101317] border-l-[3px] border-l-[#252B32] px-4 py-3 text-xs space-y-2">
                  <div className="flex items-center gap-4 text-[#8B92A0] font-mono text-[11px]">
                    <span>Head: <code className="text-[#E8EAED]">{check.head_sha?.slice(0, 7)}</code></span>
                    <span>Base: <code className="text-[#E8EAED]">{check.base_sha?.slice(0, 7)}</code></span>
                    {check.results?.bundle_kb && (
                      <span>
                        Size: <strong className="text-[#E8EAED]">{check.results.bundle_kb.after ?? '—'} KB</strong> (was {check.results.bundle_kb.before ?? '—'} KB)
                      </span>
                    )}
                  </div>

                  {causes.length > 0 ? (
                    <div className="space-y-1 pt-1">
                      <div className="text-[11px] font-semibold text-[#8B92A0] uppercase tracking-wide">
                        Identified Causes
                      </div>
                      {causes.map((c, i) => (
                        <div key={i} className="flex items-start gap-2 text-[#E8EAED]">
                          <span className="font-mono text-[11px] text-[#F5A623]">•</span>
                          <span className="font-mono text-xs">{c.cause_type}:</span>
                          <span className="text-[#8B92A0]">{c.detail || 'Detected from commit heuristics'}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[#8B92A0] italic text-[11px]">
                      No regression causes flagged for this run.
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
