import { useEffect, useRef, useState } from 'react';

const FEATURES = [
  { icon: '📦', label: 'Bundle Size', desc: 'Tracks JS bundle growth on every PR' },
  { icon: '⚡', label: 'API Latency', desc: 'p95 response time regression detection' },
  { icon: '🔍', label: 'Query Count', desc: 'Catches N+1 and unbounded DB fetches' },
  { icon: '🧠', label: 'NLP Causation', desc: 'Explains regressions from commit context' },
];

const STEPS = [
  { n: '01', icon: '🔔', text: 'PR opens → GitHub webhook fires' },
  { n: '02', icon: '📊', text: 'Baselines fetched from PostgreSQL' },
  { n: '03', icon: '🧠', text: 'NLP classifies commits (v2 model)' },
  { n: '04', icon: '✅', text: 'Check Run posted: pass or fail' },
];

const STATS = [
  { value: '10', label: 'NLP Classes' },
  { value: '384', label: 'Embed Dims' },
  { value: '<50ms', label: 'Inference' },
  { value: '3-Tier', label: 'Pipeline' },
];

export default function Login() {
  const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
  const canvasRef = useRef(null);
  const [hoveredFeature, setHoveredFeature] = useState(null);

  function handleLogin() {
    window.location.href = `${API_URL}/api/auth/github`;
  }

  // Animated particle canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf;
    const particles = [];
    const COUNT = 50;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < COUNT; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        r: Math.random() * 1.4 + 0.3,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        opacity: Math.random() * 0.45 + 0.08,
      });
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(59,130,246,${p.opacity})`;
        ctx.fill();
        for (let j = i + 1; j < particles.length; j++) {
          const dx = p.x - particles[j].x;
          const dy = p.y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(59,130,246,${0.06 * (1 - dist / 110)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <>
      {/* Global style: lock body to no scroll for this page */}
      <style>{`
        html, body, #root { height: 100%; overflow: hidden; }

        .login-root {
          height: 100vh;
          width: 100vw;
          display: flex;
          overflow: hidden;
          position: relative;
          background: #070b14;
        }

        /* ── LEFT PANEL ── */
        .login-left {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: clamp(1.5rem, 4vw, 3.5rem) clamp(1.5rem, 3vw, 3rem);
          border-right: 1px solid rgba(30,45,74,0.8);
          position: relative;
          z-index: 1;
          overflow: hidden;
        }

        .login-headline {
          font-size: clamp(1.5rem, 2.8vw, 2.25rem);
          font-weight: 800;
          letter-spacing: -0.04em;
          line-height: 1.2;
          margin-bottom: 0.75rem;
          color: var(--text-primary);
        }

        .login-sub {
          color: var(--text-secondary);
          font-size: clamp(0.8rem, 1.1vw, 0.95rem);
          line-height: 1.6;
          margin-bottom: 1.5rem;
          max-width: 380px;
        }

        .login-feature-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.625rem;
          margin-bottom: 1.5rem;
        }

        .login-feature-tile {
          background: rgba(15,22,41,0.7);
          border: 1px solid var(--border);
          border-radius: 10px;
          padding: 0.75rem;
          transition: all 0.2s ease;
          cursor: default;
          backdrop-filter: blur(8px);
        }
        .login-feature-tile:hover {
          background: rgba(59,130,246,0.08);
          border-color: rgba(59,130,246,0.4);
        }

        .login-stats {
          display: flex;
          gap: clamp(1rem, 2vw, 2rem);
          flex-wrap: nowrap;
        }

        /* ── RIGHT PANEL ── */
        .login-right {
          width: clamp(320px, 36vw, 440px);
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          padding: clamp(1rem, 2.5vw, 2.5rem);
          position: relative;
          z-index: 1;
        }

        .login-card {
          width: 100%;
          background: rgba(15,22,41,0.78);
          border: 1px solid rgba(30,45,74,0.9);
          border-radius: 20px;
          padding: clamp(1.25rem, 2.5vw, 2.25rem) clamp(1.25rem, 2vw, 2rem);
          backdrop-filter: blur(20px);
          box-shadow: 0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(59,130,246,0.06);
        }

        /* ── MOBILE: single centered card ── */
        @media (max-width: 768px) {
          .login-left { display: none; }
          .login-right {
            width: 100%;
            padding: 1.25rem;
            justify-content: center;
          }
          .login-card {
            max-width: 400px;
            margin: 0 auto;
          }
        }

        /* ── SMALL DESKTOP: compact left panel ── */
        @media (min-width: 769px) and (max-width: 1024px) {
          .login-left { padding: 1.5rem 1.75rem; }
          .login-right { width: 360px; }
        }
      `}</style>

      <div className="login-root">
        {/* Particle canvas */}
        <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }} />

        {/* Glow blobs */}
        <div style={{
          position: 'fixed', top: '-8%', left: '28%', width: '55vw', height: '50vh',
          background: 'radial-gradient(ellipse, rgba(59,130,246,0.08) 0%, transparent 70%)',
          pointerEvents: 'none', zIndex: 0,
        }} />
        <div style={{
          position: 'fixed', bottom: '-5%', right: '8%', width: '40vw', height: '40vh',
          background: 'radial-gradient(ellipse, rgba(139,92,246,0.07) 0%, transparent 70%)',
          pointerEvents: 'none', zIndex: 0,
        }} />

        {/* ── LEFT PANEL ── */}
        <div className="login-left">
          {/* Brand */}
          <div style={{ marginBottom: 'clamp(1rem, 2.5vh, 2rem)' }}>
            <div style={{ fontSize: 'clamp(1.75rem, 3vw, 2.5rem)', marginBottom: '0.25rem' }}>🛡️</div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              Deploy<span style={{ color: 'var(--accent)' }}>Guard</span>
            </div>
          </div>

          {/* Headline */}
          <h2 className="login-headline">
            Catch performance<br />
            regressions <span style={{ color: 'var(--accent)' }}>before</span><br />
            they hit production.
          </h2>

          <p className="login-sub">
            DeployGuard baselines bundle size, API latency, and query counts on every PR —
            and uses an NLP engine to explain <em>why</em> a regression happened.
          </p>

          {/* Feature tiles */}
          <div className="login-feature-grid">
            {FEATURES.map((f) => (
              <div
                key={f.label}
                className="login-feature-tile"
                onMouseEnter={() => setHoveredFeature(f.label)}
                onMouseLeave={() => setHoveredFeature(null)}
              >
                <div style={{ fontSize: '1.1rem', marginBottom: '0.2rem' }}>{f.icon}</div>
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.15rem' }}>{f.label}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{f.desc}</div>
              </div>
            ))}
          </div>

          {/* Stats row */}
          <div className="login-stats">
            {STATS.map((s) => (
              <div key={s.label}>
                <div style={{ fontSize: 'clamp(0.9rem, 1.4vw, 1.1rem)', fontWeight: 800, color: 'var(--accent)' }}>{s.value}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── RIGHT PANEL (login card) ── */}
        <div className="login-right">
          <div className="login-card fade-in">

            {/* Logo & title */}
            <div style={{ textAlign: 'center', marginBottom: 'clamp(1rem, 2vh, 1.75rem)' }}>
              <div style={{
                fontSize: 'clamp(2rem, 3.5vw, 2.75rem)', marginBottom: '0.5rem',
                filter: 'drop-shadow(0 0 16px rgba(59,130,246,0.4))',
              }}>🛡️</div>
              <h1 style={{ fontSize: 'clamp(1.25rem, 2vw, 1.65rem)', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: '0.3rem' }}>
                Welcome to <span style={{ color: 'var(--accent)' }}>DeployGuard</span>
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.825rem', lineHeight: 1.5 }}>
                Sign in to start protecting your pull requests.
              </p>
            </div>

            {/* How it works mini-steps */}
            <div style={{
              background: 'rgba(7,11,20,0.6)', borderRadius: '10px',
              border: '1px solid var(--border-subtle)',
              padding: 'clamp(0.75rem, 1.5vh, 1rem) clamp(0.875rem, 1.5vw, 1.25rem)',
              marginBottom: 'clamp(1rem, 2vh, 1.5rem)',
            }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.625rem' }}>
                How it works
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {STEPS.map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <span style={{
                      fontSize: '0.6rem', fontWeight: 700, color: 'var(--accent)',
                      background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
                      borderRadius: '4px', padding: '0.1rem 0.3rem', letterSpacing: '0.04em',
                      flexShrink: 0, fontFamily: "'JetBrains Mono', monospace",
                    }}>{s.n}</span>
                    <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>{s.icon}</span>
                    <span style={{ fontSize: '0.775rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>{s.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* GitHub sign in button */}
            <button
              id="github-login-btn"
              onClick={handleLogin}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '0.625rem', padding: 'clamp(0.7rem, 1.5vh, 0.875rem) 1.5rem',
                background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
                color: '#fff', border: 'none', borderRadius: '10px',
                fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(59,130,246,0.35)',
                transition: 'all 0.2s ease',
                fontFamily: 'inherit', letterSpacing: '-0.01em',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 28px rgba(59,130,246,0.45)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(59,130,246,0.35)';
              }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" style={{ flexShrink: 0 }}>
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
              Continue with GitHub
            </button>

            {/* Disclaimer */}
            <p style={{ marginTop: 'clamp(0.75rem, 1.5vh, 1.25rem)', fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
              By signing in you agree to install the DeployGuard GitHub App on selected repositories.
            </p>
          </div>

          {/* Bottom brand */}
          <p style={{ marginTop: '0.875rem', fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            Built by <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Saksham Hans</span> · Node.js · Python · React
          </p>
        </div>
      </div>
    </>
  );
}
