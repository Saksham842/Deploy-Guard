export default function Login() {
  const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID
  const API_URL = import.meta.env.VITE_API_URL || ''

  function handleLogin() {
    window.location.href = `${API_URL}/auth/github`
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-primary)',
      backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59,130,246,0.15), transparent)',
    }}>
      <div className="fade-in" style={{ textAlign: 'center', padding: '2rem', maxWidth: 440, width: '100%' }}>
        {/* Logo */}
        <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>🛡️</div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: '0.5rem' }}>
          Deploy<span style={{ color: 'var(--accent)' }}>Guard</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem', marginBottom: '2.5rem', lineHeight: 1.6 }}>
          Performance regression detection for every pull request.
          <br />
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>NLP-powered root cause analysis included.</span>
        </p>

        {/* Feature pills */}
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '2.5rem' }}>
          {['📦 Bundle Size', '⚡ API Latency', '🔍 Query Count', '🧠 NLP Causation'].map(f => (
            <span key={f} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              padding: '0.375rem 0.75rem', borderRadius: '999px',
              fontSize: '0.8rem', color: 'var(--text-secondary)',
            }}>{f}</span>
          ))}
        </div>

        {/* Sign in button */}
        <button
          id="github-login-btn"
          className="btn btn-primary"
          onClick={handleLogin}
          style={{ width: '100%', justifyContent: 'center', padding: '0.875rem 1.5rem', fontSize: '1rem' }}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
          </svg>
          Sign in with GitHub
        </button>

        <p style={{ marginTop: '1.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          By signing in you agree to install the DeployGuard GitHub App on your repositories.
        </p>
      </div>
    </div>
  )
}
