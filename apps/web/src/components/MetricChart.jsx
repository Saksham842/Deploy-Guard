import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine
} from 'recharts'

export default function MetricChart({ checks, metric = 'bundle_kb', label = 'Bundle Size (KB)', threshold }) {
  const data = [...checks]
    .reverse()
    .map((c, i) => ({
      name: `#${c.pr_number}`,
      value: c.results?.[metric]?.after ?? null,
      baseline: c.results?.[metric]?.before ?? null,
      index: i,
    }))
    .filter(d => d.value !== null)

  if (data.length === 0) {
    return (
      <div style={{ height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
        No data yet — run a check to see the chart
      </div>
    )
  }

  const CustomTooltip = ({ active, payload, label: l }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.75rem 1rem', fontSize: '0.8rem' }}>
        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>PR {l}</div>
        <div style={{ color: 'var(--accent)' }}>{label}: <strong>{payload[0]?.value}</strong></div>
      </div>
    )
  }

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
  )
}
