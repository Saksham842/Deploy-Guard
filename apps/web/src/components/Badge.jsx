export default function Badge({ status }) {
  const config = {
    pass: {
      label: 'PASS',
      dotClass: 'bg-[#3DD68C]',
      containerClass: 'bg-[rgba(61,214,140,0.08)] text-[#3DD68C] border-[rgba(61,214,140,0.25)]',
    },
    fail: {
      label: 'FAIL',
      dotClass: 'bg-[#F0605A]',
      containerClass: 'bg-[rgba(240,96,90,0.08)] text-[#F0605A] border-[rgba(240,96,90,0.25)]',
    },
    pending: {
      label: 'RUNNING',
      dotClass: 'bg-[#F5A623] animate-pulse',
      containerClass: 'bg-[rgba(245,166,35,0.08)] text-[#F5A623] border-[rgba(245,166,35,0.25)]',
    },
    error: {
      label: 'ERROR',
      dotClass: 'bg-[#8B92A0]',
      containerClass: 'bg-[rgba(139,146,160,0.08)] text-[#8B92A0] border-[rgba(139,146,160,0.25)]',
    },
  };

  const { label, dotClass, containerClass } = config[status] || config.error;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-mono font-medium tracking-wide ${containerClass}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      {label}
    </span>
  );
}
