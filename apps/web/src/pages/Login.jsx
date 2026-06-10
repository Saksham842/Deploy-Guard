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
  { value: '384', label: 'Embedding Dims' },
  { value: '< 50ms', label: 'Inference Time' },
  { value: '3-Tier', label: 'ML Pipeline' },
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
    const PARTICLE_COUNT = 55;

    function resize() {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.5 + 0.3,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        opacity: Math.random() * 0.5 + 0.1,
      });
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
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
      });

      // draw faint connecting lines
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 120) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.strokeStyle = `rgba(59,130,246,${0.07 * (1 - dist / 120)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', position: 'relative', overflow: 'hidden', background: '#070b14' }}>
      {/* animated particle background */}
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0 }} />

      {/* glow blobs */}
      <div style={{
        position: 'fixed', top: '-10%', left: '30%', width: '600px', height: '500px',
        background: 'radial-gradient(ellipse, rgba(59,130,246,0.08) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />
      <div style={{
        position: 'fixed', bottom: '-5%', right: '10%', width: '500px', height: '400px',
        background: 'radial-gradient(ellipse, rgba(139,92,246,0.07) 0%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* ─── LEFT PANEL (hidden on small screens via media query) ─── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: '4rem 3rem 4rem 4rem', position: 'relative', zIndex: 1,
        borderRight: '1px solid rgba(30,45,74,0.8)',
      }} className="login-left-panel">

        {/* Brand */}
        <div style={{ marginBottom: '3rem' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🛡️</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Deploy<span style={{ color: 'var(--accent)' }}>Guard</span>
          </div>
        </div>

        {/* Headline */}
        <h2 style={{
          fontSize: '2.25rem', fontWeight: 800, letterSpacing: '-0.04em',
          lineHeight: 1.2, marginBottom: '1rem', color: 'var(--text-primary)',
        }}>
          Catch performance<br />
          regressions <span style={{ color: 'var(--accent)' }}>before</span><br />
          they hit production.
        </h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.7, marginBottom: '2.5rem', maxWidth: '380px' }}>
          DeployGuard automatically baselines bundle size, API latency, and query counts
          on every pull request — and uses an NLP engine to explain <em>why</em> a regression happened.
        </p>

        {/* Feature tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '3rem' }}>
          {FEATURES.map((f) => (
            <div
              key={f.label}
              onMouseEnter={() => setHoveredFeature(f.label)}
              onMouseLeave={() => setHoveredFeature(null)}
              style={{
                background: hoveredFeature === f.label ? 'rgba(59,130,246,0.08)' : 'rgba(15,22,41,0.7)',
                border: hoveredFeature === f.label ? '1px solid rgba(59,130,246,0.4)' : '1px solid var(--border)',
                borderRadius: '10px', padding: '0.875rem 1rem',
                transition: 'all 0.2s ease', cursor: 'default',
                backdropFilter: 'blur(8px)',
              }}
            >
              <div style={{ fontSize: '1.15rem', marginBottom: '0.25rem' }}>{f.icon}</div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{f.label}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{f.desc}</div>
            </div>
          ))}
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
          {STATS.map((s) => (
            <div key={s.label}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--accent)' }}>{s.value}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase', fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── RIGHT PANEL (login card) ─── */}
      <div style={{
        width: '440px', flexShrink: 0, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', alignItems: 'center',
        padding: '3rem 2.5rem', position: 'relative', zIndex: 1,
      }}>
        <div className="fade-in" style={{
          width: '100%',
          background: 'rgba(15,22,41,0.75)',
          border: '1px solid rgba(30,45,74,0.9)',
          borderRadius: '20px',
          padding: '2.5rem 2rem',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(59,130,246,0.06)',
        }}>
          {/* Logo & title */}
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{
              fontSize: '2.75rem', marginBottom: '0.75rem',
              filter: 'drop-shadow(0 0 18px rgba(59,130,246,0.4))',
            }}>🛡️</div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: '0.375rem' }}>
              Welcome to <span style={{ color: 'var(--accent)' }}>DeployGuard</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.6 }}>
              Sign in to start protecting your pull requests.
            </p>
          </div>

          {/* How it works mini-steps */}
          <div style={{
            background: 'rgba(7,11,20,0.6)', borderRadius: '12px',
            border: '1px solid var(--border-subtle)', padding: '1rem 1.25rem',
            marginBottom: '1.75rem',
          }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.875rem' }}>
              How it works
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {STEPS.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{
                    fontSize: '0.65rem', fontWeight: 700, color: 'var(--accent)',
                    background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
                    borderRadius: '4px', padding: '0.1rem 0.35rem', letterSpacing: '0.04em',
                    flexShrink: 0, fontFamily: "'JetBrains Mono', monospace",
                  }}>{s.n}</span>
                  <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>{s.icon}</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>{s.text}</span>
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
              gap: '0.625rem', padding: '0.875rem 1.5rem',
              background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
              color: '#fff', border: 'none', borderRadius: '10px',
              fontSize: '0.975rem', fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(59,130,246,0.35)',
              transition: 'all 0.2s ease',
              fontFamily: 'inherit',
              letterSpacing: '-0.01em',
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
            <svg viewBox="0 0 24 24" width="19" height="19" fill="currentColor" style={{ flexShrink: 0 }}>
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
            Continue with GitHub
          </button>

          {/* Disclaimer */}
          <p style={{ marginTop: '1.25rem', fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.5 }}>
            By signing in you agree to install the DeployGuard GitHub App<br />
            on selected repositories. No credit card required.
          </p>
        </div>

        {/* bottom brand line */}
        <p style={{ marginTop: '1.5rem', fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          Built by <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Saksham Hans</span> · Node.js · Python · React
        </p>
      </div>

      {/* Responsive: hide left panel on small screens */}
      <style>{`
        @media (max-width: 820px) {
          .login-left-panel { display: none !important; }
        }
      `}</style>
    </div>
  );
}
