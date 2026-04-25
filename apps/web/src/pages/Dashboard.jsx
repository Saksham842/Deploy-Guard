import { useState, useEffect } from 'react'
import { api } from '../api'
import RepoCard from '../components/RepoCard'

export default function Dashboard() {
  const [repos, setRepos]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  useEffect(() => {
    api.getRepos()
      .then(data => { setRepos(data); setLoading(false) })
      .catch(err  => { setError(err.message); setLoading(false) })
  }, [])

  const passCount  = repos.filter(r => r.last_check?.status === 'pass').length
  const failCount  = repos.filter(r => r.last_check?.status === 'fail').length
  const totalChecks = repos.reduce((acc, r) => acc + (r.check_count || 0), 0)

  return (
    <div className="fade-in">
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.25rem' }}>
          Dashboard
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Performance baseline monitoring across all connected repositories
        </p>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard label="Connected Repos" value={repos.length} icon="📦" />
        <StatCard label="Passing"          value={passCount}   icon="✅" color="var(--green)" />
        <StatCard label="Failing"          value={failCount}   icon="❌" color="var(--red)" />
        <StatCard label="Total Checks"     value={totalChecks} icon="🔍" />
      </div>

      {/* Repos grid */}
      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {[1,2,3].map(i => (
            <div key={i} className="card">
              <div className="skeleton" style={{ height: 18, width: '60%', marginBottom: '0.75rem' }} />
              <div className="skeleton" style={{ height: 14, width: '40%', marginBottom: '0.5rem' }} />
              <div className="skeleton" style={{ height: 14, width: '80%' }} />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{ background: 'var(--red-glow)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '1rem 1.25rem', color: 'var(--red)' }}>
          ⚠️ {error}
        </div>
      )}

      {!loading && !error && repos.length === 0 && (
        <EmptyState />
      )}

      {!loading && repos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
          {repos.map(repo => <RepoCard key={repo.id} repo={repo} />)}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, icon, color }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{icon} {label}</div>
      <div className="stat-value" style={{ color: color || 'var(--text-primary)' }}>{value}</div>
    </div>
  )
}

function EmptyState() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔭</div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.5rem' }}>No repos connected yet</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: 360, margin: '0 auto 1.5rem' }}>
        Install the DeployGuard GitHub App on your repositories to start tracking performance regressions.
      </p>
      <a
        href="https://github.com/apps/deployguard-saksham842"
        target="_blank" rel="noopener noreferrer"
        className="btn btn-primary"
      >
        Install GitHub App →
      </a>
    </div>
  )
}
