import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api'
import MetricChart from '../components/MetricChart'
import CheckRow from '../components/CheckRow'
import Badge from '../components/Badge'

export default function RepoDetail() {
  const { owner, name } = useParams()
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  useEffect(() => {
    api.getRepoChecks(owner, name)
      .then(d => { setData(d); setLoading(false) })
      .catch(e => { setError(e.message); setLoading(false) })
  }, [owner, name])

  if (loading) return <LoadingSkeleton />
  if (error)   return <ErrorBanner message={error} />

  const { repo, checks } = data
  const lastCheck = checks[0]
  const passRate  = checks.length
    ? Math.round((checks.filter(c => c.status === 'pass').length / checks.length) * 100)
    : null

  return (
    <div className="fade-in">
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        <Link to="/dashboard" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Dashboard</Link>
        <span>/</span>
        <span>{owner}</span>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{name}</span>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.25rem' }}>
            {owner}/<span style={{ color: 'var(--accent)' }}>{name}</span>
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {lastCheck && <Badge status={lastCheck.status} />}
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Threshold: bundle ±{repo.threshold_config?.bundle_kb ?? 10}%
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <a
            href={`https://github.com/${owner}/${name}`}
            target="_blank" rel="noopener noreferrer"
            className="btn btn-ghost"
          >
            View on GitHub →
          </a>
          <Link to={`/repo/${owner}/${name}/settings`} className="btn btn-ghost">⚙️ Settings</Link>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard label="Total Checks"   value={checks.length} />
        <StatCard label="Pass Rate"      value={passRate !== null ? `${passRate}%` : '—'} color={passRate >= 80 ? 'var(--green)' : passRate >= 50 ? 'var(--yellow)' : 'var(--red)'} />
        <StatCard label="Latest Bundle"  value={lastCheck?.results?.bundle_kb?.after ? `${lastCheck.results.bundle_kb.after} KB` : '—'} />
        <StatCard label="Latest Delta"   value={lastCheck?.results?.bundle_kb?.delta != null ? `${lastCheck.results.bundle_kb.delta > 0 ? '+' : ''}${lastCheck.results.bundle_kb.delta.toFixed(1)}%` : '—'} />
      </div>

      {/* Bundle trend chart */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>📦 Bundle Size Trend</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Last {checks.length} checks</span>
        </div>
        <MetricChart checks={checks} metric="bundle_kb" label="Bundle (KB)" threshold={lastCheck?.results?.bundle_kb?.before ? lastCheck.results.bundle_kb.before * (1 + (repo.threshold_config?.bundle_kb ?? 10) / 100) : undefined} />
      </div>

      {/* Checks table */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 700 }}>🔍 Recent Checks</h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Showing last {Math.min(checks.length, 10)}</span>
        </div>

        {checks.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No checks yet — open a PR to trigger DeployGuard.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>PR</th>
                  <th>Status</th>
                  <th>Bundle Δ</th>
                  <th>NLP Cause</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {checks.slice(0, 10).map(c => (
                  <CheckRow key={c.id} check={c} owner={owner} name={name} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, color }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value" style={{ fontSize: '1.5rem', color: color || 'var(--text-primary)' }}>{value}</div>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="fade-in">
      <div className="skeleton" style={{ height: 28, width: '30%', marginBottom: '2rem' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        {[1,2,3,4].map(i => <div key={i} className="skeleton" style={{ height: 80 }} />)}
      </div>
      <div className="skeleton" style={{ height: 300, marginBottom: '1.5rem' }} />
      <div className="skeleton" style={{ height: 200 }} />
    </div>
  )
}

function ErrorBanner({ message }) {
  return (
    <div style={{ background: 'var(--red-glow)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '1rem 1.25rem', color: 'var(--red)' }}>
      ⚠️ {message}
    </div>
  )
}
