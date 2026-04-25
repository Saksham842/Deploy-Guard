import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api'

export default function Settings() {
  const { owner, name } = useParams()
  const [thresholds, setThresholds] = useState({ bundle_kb: 10, query_count: 20, api_p95_ms: 200 })
  const [loading, setLoading]   = useState(true)
  const [saving,  setSaving]    = useState(false)
  const [saved,   setSaved]     = useState(false)
  const [error,   setError]     = useState(null)

  useEffect(() => {
    api.getThresholds(owner, name)
      .then(t => { setThresholds(t); setLoading(false) })
      .catch(() => setLoading(false))
  }, [owner, name])

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true); setError(null); setSaved(false)
    try {
      await api.updateThresholds(owner, name, thresholds)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  function handleChange(key, value) {
    setThresholds(prev => ({ ...prev, [key]: Number(value) }))
  }

  return (
    <div className="fade-in" style={{ maxWidth: 560 }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        <Link to="/dashboard" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Dashboard</Link>
        <span>/</span>
        <Link to={`/repo/${owner}/${name}`} style={{ color: 'var(--accent)', textDecoration: 'none' }}>{owner}/{name}</Link>
        <span>/</span>
        <span style={{ color: 'var(--text-primary)' }}>Settings</span>
      </div>

      <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.25rem' }}>⚙️ Threshold Settings</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>
        A PR is marked as failing if any metric exceeds its threshold.
      </p>

      {loading ? (
        <div>
          {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 80, marginBottom: '1rem' }} />)}
        </div>
      ) : (
        <form onSubmit={handleSave}>
          <div className="card" style={{ marginBottom: '1rem' }}>
            <ThresholdField
              label="📦 Bundle Size"
              description="Maximum allowed % increase in total bundle size"
              unit="% increase"
              id="bundle_kb"
              value={thresholds.bundle_kb}
              onChange={v => handleChange('bundle_kb', v)}
              min={1} max={100}
            />
          </div>

          <div className="card" style={{ marginBottom: '1rem' }}>
            <ThresholdField
              label="🔢 Query Count"
              description="Maximum allowed % increase in DB query count per request"
              unit="% increase"
              id="query_count"
              value={thresholds.query_count}
              onChange={v => handleChange('query_count', v)}
              min={1} max={100}
            />
          </div>

          <div className="card" style={{ marginBottom: '2rem' }}>
            <ThresholdField
              label="⚡ API p95 Latency"
              description="Maximum allowed % increase in API response time (p95)"
              unit="% increase"
              id="api_p95_ms"
              value={thresholds.api_p95_ms}
              onChange={v => handleChange('api_p95_ms', v)}
              min={1} max={200}
            />
          </div>

          {error && (
            <div style={{ background: 'var(--red-glow)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '0.75rem 1rem', color: 'var(--red)', marginBottom: '1rem', fontSize: '0.875rem' }}>
              ⚠️ {error}
            </div>
          )}

          {saved && (
            <div style={{ background: 'var(--green-glow)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, padding: '0.75rem 1rem', color: 'var(--green)', marginBottom: '1rem', fontSize: '0.875rem' }}>
              ✅ Thresholds saved — next check will use these values
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button id="save-thresholds-btn" type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save thresholds'}
            </button>
            <Link to={`/repo/${owner}/${name}`} className="btn btn-ghost">Cancel</Link>
          </div>
        </form>
      )}
    </div>
  )
}

function ThresholdField({ label, description, unit, id, value, onChange, min, max }) {
  return (
    <div>
      <label htmlFor={id} style={{ display: 'block', fontWeight: 600, marginBottom: '0.25rem', fontSize: '0.9rem' }}>
        {label}
      </label>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>{description}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <input
          id={id}
          type="number"
          className="input"
          value={value}
          min={min} max={max}
          onChange={e => onChange(e.target.value)}
          style={{ maxWidth: 120 }}
        />
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{unit}</span>
        <input
          type="range"
          min={min} max={max}
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{ flex: 1, accentColor: 'var(--accent)' }}
        />
      </div>
    </div>
  )
}
