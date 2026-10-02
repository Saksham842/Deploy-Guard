export default function Badge({ status }) {
  const config = {
    pass: {
      label: 'PASS',
      dotClass: 'bg-emerald-400',
      pingClass: 'bg-emerald-400/40',
      containerClass: 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]',
    },
    fail: {
      label: 'FAIL',
      dotClass: 'bg-rose-500',
      pingClass: 'bg-rose-500/40',
      containerClass: 'bg-rose-950/40 text-rose-400 border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.15)]',
    },
    pending: {
      label: 'RUNNING',
      dotClass: 'bg-amber-400',
      pingClass: 'bg-amber-400/50',
      containerClass: 'bg-amber-950/40 text-amber-400 border-amber-500/30 shadow-[0_0_12px_rgba(245,158,11,0.15)]',
    },
    error: {
      label: 'ERROR',
      dotClass: 'bg-slate-400',
      pingClass: 'bg-slate-400/30',
      containerClass: 'bg-slate-900/60 text-slate-400 border-slate-700/50',
    },
  };

  const { label, dotClass, pingClass, containerClass } = config[status] || config.error;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-[10px] font-mono font-bold tracking-wider uppercase transition-all duration-200 ${containerClass}`}
    >
      <span className="relative flex h-2 w-2">
        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${pingClass}`} />
        <span className={`relative inline-flex rounded-full h-2 w-2 ${dotClass}`} />
      </span>
      {label}
    </span>
  );
}
