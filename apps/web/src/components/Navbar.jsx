import { Link, useNavigate } from 'react-router-dom'

export default function Navbar() {
  const navigate = useNavigate()
  const username  = localStorage.getItem('dg_username')
  const avatar    = localStorage.getItem('dg_avatar')

  function handleLogout() {
    localStorage.clear()
    navigate('/login')
  }

  return (
    <nav style={{
      background: 'var(--bg-card)',
      borderBottom: '1px solid var(--border)',
      padding: '0 2rem',
      height: '60px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', textDecoration: 'none' }}>
        <span style={{ fontSize: '1.25rem' }}>🛡️</span>
        <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Deploy<span style={{ color: 'var(--accent)' }}>Guard</span>
        </span>
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <Link to="/docs" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500 }}
          className="nav-link">
          How it works
        </Link>
        <Link to="/dashboard" style={{ color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500 }}
          className="nav-link">
          Dashboard
        </Link>
        {username && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {avatar && (
              <img src={avatar} alt={username} style={{ width: 30, height: 30, borderRadius: '50%', border: '2px solid var(--border)' }} />
            )}
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{username}</span>
            <button className="btn btn-ghost" style={{ padding: '0.375rem 0.75rem', fontSize: '0.8rem' }} onClick={handleLogout}>
              Sign out
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
