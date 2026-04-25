import { Link } from 'react-router-dom'
import Badge from './Badge'

export default function RepoCard({ repo }) {
  const lastCheck = repo.last_check
  const timeAgo   = lastCheck ? formatRelativeTime(new Date(lastCheck.created_at)) : 'Never checked'

  return (
    <Link to={`/repo/${repo.owner}/${repo.name}`} style={{ textDecoration: 'none' }}>
      <div className="card" style={{ cursor: 'pointer' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.875rem', gap: '1rem' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '1rem', flexShrink: 0 }}>📦</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{repo.owner} /</span>
            </div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{repo.name}</h3>
          </div>
          <div style={{ flexShrink: 0 }}>
            {lastCheck ? (
              <Badge status={lastCheck.status} />
            ) : (
              <span className="badge badge-pending" style={{ whiteSpace: 'nowrap' }}>No checks yet</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1.5rem', marginTop: '1rem' }}>
          {lastCheck?.results?.bundle_kb && (
            <Metric
              label="Bundle"
              value={`${lastCheck.results.bundle_kb.after} KB`}
              delta={lastCheck.results.bundle_kb.delta}
            />
          )}
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.125rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Last check</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{timeAgo}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.125rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>PR</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{lastCheck ? `#${lastCheck.pr_number}` : '—'}</div>
          </div>
        </div>
      </div>
    </Link>
  )
}

function Metric({ label, value, delta }) {
  const isPositive = delta > 0
  const color = delta > 10 ? 'var(--red)' : delta > 5 ? 'var(--yellow)' : 'var(--green)'
  return (
    <div>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.125rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: 600 }}>
        {value}
        {delta !== undefined && delta !== null && (
          <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color, fontWeight: 500 }}>
            {isPositive ? '+' : ''}{delta.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  )
}

function formatRelativeTime(date) {
  const diff = (Date.now() - date.getTime()) / 1000
  if (diff < 60)   return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}
