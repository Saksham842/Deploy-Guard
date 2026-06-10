export default function Badge({ status }) {
  const config = {
    pass: {
      label: '✅ Pass',
      cls: 'bg-green-500/10 text-green-500 border border-green-500/30'
    },
    fail: {
      label: '❌ Fail',
      cls: 'bg-red-500/10 text-red-500 border border-red-500/30'
    },
    pending: {
      label: '⏳ Running',
      cls: 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/30'
    },
    error: {
      label: '⚠️ Error',
      cls: 'bg-slate-500/10 text-slate-400 border border-slate-500/30'
    },
  };
  
  const { label, cls } = config[status] || config.error;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase ${cls}`}>
      {label}
    </span>
  );
}
