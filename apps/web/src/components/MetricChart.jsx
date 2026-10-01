import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

export default function MetricChart({ checks, metric = 'bundle_kb', label = 'Bundle Size (KB)', threshold, baselineValue }) {
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
      <div className="h-56 flex items-center justify-center text-[#8B92A0] text-xs font-mono">
        No checks yet — open a PR to record your first baseline
      </div>
    );
  }

  // Determine line color from the most recent check status
  const lastCheck = data[data.length - 1];
  const lineColor = lastCheck?.passed ? '#3DD68C' : '#F0605A';

  const CustomTooltip = ({ active, payload, label: l }) => {
    if (!active || !payload?.length) return null;
    const item = payload[0];
    return (
      <div className="bg-[#161A1F] border border-[#252B32] rounded px-3 py-2 text-xs shadow-xl">
        <div className="text-[#8B92A0] text-[11px] mb-1 font-mono">PR {l}</div>
        <div className="text-[#E8EAED] font-mono font-medium">
          {label}: <span className="font-semibold" style={{ color: lineColor }}>{item.value} KB</span>
        </div>
      </div>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={230}>
      <LineChart data={data} margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
        <XAxis
          dataKey="name"
          tick={{ fill: '#8B92A0', fontSize: 11, fontFamily: 'JetBrains Mono' }}
          axisLine={{ stroke: '#252B32' }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#8B92A0', fontSize: 11, fontFamily: 'JetBrains Mono' }}
          axisLine={{ stroke: '#252B32' }}
          tickLine={false}
          domain={['auto', 'auto']}
        />
        <Tooltip content={<CustomTooltip />} />
        
        {/* Single baseline reference line instead of noisy default gridlines */}
        {baselineValue !== undefined && baselineValue !== null && (
          <ReferenceLine
            y={baselineValue}
            stroke="#252B32"
            strokeDasharray="4 4"
            label={{ value: 'Baseline', fill: '#8B92A0', fontSize: 10, position: 'insideTopLeft', fontFamily: 'JetBrains Mono' }}
          />
        )}

        {threshold && (
          <ReferenceLine
            y={threshold}
            stroke="rgba(240, 96, 90, 0.45)"
            strokeDasharray="3 3"
            label={{ value: 'Limit', fill: '#F0605A', fontSize: 10, position: 'insideTopRight', fontFamily: 'JetBrains Mono' }}
          />
        )}

        <Line
          type="monotone"
          dataKey="value"
          stroke={lineColor}
          strokeWidth={2}
          dot={{ fill: lineColor, r: 3, strokeWidth: 0 }}
          activeDot={{ r: 5, strokeWidth: 2, stroke: '#161A1F' }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
