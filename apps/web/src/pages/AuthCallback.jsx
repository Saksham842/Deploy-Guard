import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const params   = new URLSearchParams(window.location.search)
    const token    = params.get('token')
    const username = params.get('username')
    const avatar   = params.get('avatar')

    if (token) {
      localStorage.setItem('dg_token',    token)
      localStorage.setItem('dg_username', username || '')
      localStorage.setItem('dg_avatar',   avatar   || '')
      navigate('/dashboard', { replace: true })
    } else {
      navigate('/login', { replace: true })
    }
  }, [navigate])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ fontSize: '2rem' }}>🔐</div>
      <p style={{ color: 'var(--text-secondary)' }}>Completing sign-in…</p>
    </div>
  )
}
