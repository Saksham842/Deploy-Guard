import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

export default function MetricChart({ checks, metric = 'bundle_kb', label = 'Bundle Size', threshold, baselineValue }) {
  const data = [...checks]
    .reverse()
    .map((c) => ({
      name: `#${c.pr_number}`,
      value: c.results?.[metric]?.after ?? null,
      passed: c.status === 'pass',
    }))
    .filter((d) => d.value !== null);

  if (data.length === 0) {
    return (
      <div className="h-56 flex items-center justify-center text-[#9CA3AF] text-xs font-mono">
        No checks yet — open a PR to record your first baseline
      </div>
    );
  }

  // Determine line color from the most recent check status
  const lastCheck = data[data.length - 1];
  const isPass = lastCheck?.passed;
  const strokeColor = isPass ? '#10B981' : '#F43F5E';
  const gradientId = isPass ? 'gradient-pass' : 'gradient-fail';

  const CustomTooltip = ({ active, payload, label: l }) => {
    if (!active || !payload?.length) return null;
    const item = payload[0];
    return (
      <div className="bg-[#0E1118]/95 backdrop-blur-xl border border-white/[0.12] rounded-xl px-3.5 py-2.5 text-xs shadow-2xl font-mono">
        <div className="text-[#9CA3AF] text-[10px] mb-1 font-semibold uppercase tracking-wider">
          Pull Request {l}
        </div>
        <div className="text-white flex items-center gap-2">
          <span>{label}:</span>
          <span className="font-bold text-sm" style={{ color: strokeColor }}>
            {item.value} KB
          </span>
        </div>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={230}>
      <AreaChart data={data} margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="gradient-pass" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
          </linearGradient>
          <linearGradient id="gradient-fail" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#F43F5E" stopOpacity={0.0} />
          </linearGradient>
        </defs>

        <XAxis
          dataKey="name"
          tick={{ fill: '#9CA3AF', fontSize: 10, fontFamily: 'JetBrains Mono' }}
          axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#9CA3AF', fontSize: 10, fontFamily: 'JetBrains Mono' }}
          axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
          tickLine={false}
          domain={['auto', 'auto']}
        />
        <Tooltip content={<CustomTooltip />} />
        
        {/* Baseline reference line */}
        {baselineValue !== undefined && baselineValue !== null && (
          <ReferenceLine
            y={baselineValue}
            stroke="rgba(255,255,255,0.15)"
            strokeDasharray="4 4"
            label={{ value: 'Baseline', fill: '#9CA3AF', fontSize: 10, position: 'insideTopLeft', fontFamily: 'JetBrains Mono' }}
          />
        )}

        {threshold && (
          <ReferenceLine
            y={threshold}
            stroke="rgba(244, 63, 94, 0.6)"
            strokeDasharray="3 3"
            label={{ value: 'Budget Limit', fill: '#F43F5E', fontSize: 10, position: 'insideTopRight', fontFamily: 'JetBrains Mono' }}
          />
        )}

        <Area
          type="monotone"
          dataKey="value"
          stroke={strokeColor}
          strokeWidth={2.5}
          fill={`url(#${gradientId})`}
          dot={{ fill: strokeColor, r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, strokeWidth: 2, stroke: '#08090C' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
