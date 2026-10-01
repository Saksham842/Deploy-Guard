import { useState } from 'react';
import Badge from './Badge';

export default function CheckRow({ check, owner, name }) {
  const [expanded, setExpanded] = useState(false);
  const delta = check.results?.bundle_kb?.delta;
  const isPass = check.status === 'pass';
  const isFail = check.status === 'fail';

  const stripeClass = isPass
    ? 'border-l-[#3DD68C]'
    : isFail
    ? 'border-l-[#F0605A]'
    : 'border-l-[#F5A623]';

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
        className={`border-l-[3px] ${stripeClass} cursor-pointer transition-colors duration-150 hover:bg-[#1C2128]`}
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
          <span className="inline-block transition-transform duration-200 text-[#57606A]" style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
            ›
          </span>
        </td>
      </tr>

      {/* Smooth expanding cause details */}
      <tr>
        <td colSpan={5} className="p-0 border-b border-[#1B2026]">
          <div
            className="overflow-hidden transition-all duration-200 ease-out"
            style={{
              maxHeight: expanded ? '240px' : '0px',
              opacity: expanded ? 1 : 0,
            }}
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
          </div>
        </td>
      </tr>
    </>
  );
}
