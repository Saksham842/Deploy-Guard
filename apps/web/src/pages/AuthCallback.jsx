import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Handles the redirect back from GitHub OAuth.
// Extracts token + user info from query params and stores them before routing.
export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');

    if (token) {
      localStorage.setItem('dg_token', token);
      localStorage.setItem('dg_username', params.get('username') || '');
      localStorage.setItem('dg_avatar', params.get('avatar') || '');
      navigate('/dashboard', { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="text-4xl">🔐</div>
      <p className="text-slate-400">Completing sign-in…</p>
    </div>
  );
}
