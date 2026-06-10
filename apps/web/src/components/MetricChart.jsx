import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

// Renders a bundle-size trend line chart using Recharts.
// Recharts SVG props (stroke, fill, etc.) must remain inline — they are SVG attributes, not CSS.
export default function MetricChart({ checks, metric = 'bundle_kb', label = 'Bundle Size (KB)', threshold }) {
  const data = [...checks]
    .reverse()
    .map((c) => ({
      name: `#${c.pr_number}`,
      value: c.results?.[metric]?.after ?? null,
    }))
    .filter((d) => d.value !== null);

  if (data.length === 0) {
    return (
      <div className="h-60 flex items-center justify-center text-slate-500 text-sm">
        No data yet — open a PR to trigger the first check
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label: l }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-[#0f1629] border border-[#1e2d4a] rounded-lg px-3 py-2 text-xs">
        <div className="font-semibold text-white mb-1">PR {l}</div>
        <div className="text-blue-400">{label}: <strong>{payload[0]?.value}</strong></div>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
        <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        {threshold && (
          <ReferenceLine
            y={threshold}
            stroke="var(--red)"
            strokeDasharray="4 4"
            label={{ value: 'Threshold', fill: 'var(--red)', fontSize: 10, position: 'insideTopRight' }}
          />
        )}
        <Line
          type="monotone"
          dataKey="value"
          stroke="var(--accent)"
          strokeWidth={2.5}
          dot={{ fill: 'var(--accent)', r: 4, strokeWidth: 0 }}
          activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
