import Badge from './Badge'
import { Link } from 'react-router-dom'

export default function CheckRow({ check, owner, name }) {
  const delta     = check.results?.bundle_kb?.delta
  const deltaStr  = delta !== undefined && delta !== null ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)}%` : '—'
  const deltaColor = delta > 10 ? 'var(--red)' : delta > 5 ? 'var(--yellow)' : delta <= 0 ? 'var(--green)' : 'var(--text-secondary)'
  const date      = new Date(check.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  const topCause  = check.causes?.[0]

  return (
    <tr>
      <td>
        <a
          href={`https://github.com/${owner}/${name}/pull/${check.pr_number}`}
          target="_blank" rel="noopener noreferrer"
          style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}
        >
          #{check.pr_number}
        </a>
      </td>
      <td><Badge status={check.status} /></td>
      <td style={{ color: deltaColor, fontWeight: 600, fontFamily: 'var(--mono)' }}>{deltaStr}</td>
      <td>
        {topCause ? (
          <span style={{ fontSize: '0.8rem', background: 'var(--bg-card-hover)', padding: '0.2rem 0.5rem', borderRadius: '4px', color: 'var(--text-secondary)' }}>
            {topCause.cause_type.replace(/_/g, ' ')} · {Math.round(topCause.confidence * 100)}%
          </span>
        ) : '—'}
      </td>
      <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{date}</td>
    </tr>
  )
}
