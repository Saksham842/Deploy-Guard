import { useEffect, useState } from 'react';
import ParticleBackground from '../components/ParticleBackground';

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

  // Splash phases: 'entering' → 'pulsing' → 'exiting' → 'done'
  const [splashPhase, setSplashPhase] = useState('entering');

  useEffect(() => {
    // Phase 1: logo enters big (0ms)
    // Phase 2: pulses for a moment (600ms)
    const t1 = setTimeout(() => setSplashPhase('pulsing'), 600);
    // Phase 3: starts fading/shrinking out (1800ms)
    const t2 = setTimeout(() => setSplashPhase('exiting'), 1800);
    // Phase 4: completely gone, login page revealed (2300ms)
    const t3 = setTimeout(() => setSplashPhase('done'), 2300);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  // Scroll lock
  useEffect(() => {
    const prev = {
      bodyOverflow: document.body.style.overflow,
      bodyHeight: document.body.style.height,
      htmlOverflow: document.documentElement.style.overflow,
      htmlHeight: document.documentElement.style.height,
    };
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100%';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.height = '100%';
    return () => {
      // Use removeProperty so the body's own overflow-y:auto rule takes over
      // immediately — no risk of '' vs 'hidden' restoration race conditions
      document.body.style.removeProperty('overflow');
      document.body.style.removeProperty('height');
      document.documentElement.style.removeProperty('overflow');
      document.documentElement.style.removeProperty('height');
    };
  }, []);

  function handleLogin() {
    window.location.href = `${API_URL}/api/auth/github`;
  }

  const splashDone = splashPhase === 'done';
  const splashExiting = splashPhase === 'exiting';

  return (
    <div className="relative w-screen h-screen flex overflow-hidden bg-[#070b14] text-[#f1f5f9] select-none font-sans">
      <ParticleBackground />

      {/* ═══════════════════════════════════════
          SPLASH SCREEN INTRO
          ═══════════════════════════════════════ */}
      {!splashDone && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#070b14',
            transition: 'opacity 0.5s ease, transform 0.5s ease, filter 0.5s ease',
            opacity: splashExiting ? 0 : 1,
            transform: splashExiting ? 'scale(0.88) translateY(-24px)' : 'scale(1) translateY(0)',
            filter: splashExiting ? 'blur(8px)' : 'blur(0px)',
          }}
        >
          {/* Outer glow ring */}
          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {/* Animated rings */}
            <div style={{
              position: 'absolute',
              width: 160,
              height: 160,
              borderRadius: '50%',
              border: '1px solid rgba(59,130,246,0.25)',
              animation: 'ringPulse 1.4s ease-out infinite',
            }} />
            <div style={{
              position: 'absolute',
              width: 200,
              height: 200,
              borderRadius: '50%',
              border: '1px solid rgba(59,130,246,0.12)',
              animation: 'ringPulse 1.4s ease-out 0.3s infinite',
            }} />
            <div style={{
              position: 'absolute',
              width: 250,
              height: 250,
              borderRadius: '50%',
              border: '1px solid rgba(59,130,246,0.06)',
              animation: 'ringPulse 1.4s ease-out 0.6s infinite',
            }} />

            {/* Central glow disc */}
            <div style={{
              position: 'absolute',
              width: 110,
              height: 110,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(59,130,246,0.22) 0%, transparent 70%)',
              animation: 'glowPulse 1.4s ease-in-out infinite',
            }} />

            {/* Logo emoji */}
            <div style={{
              fontSize: 72,
              lineHeight: 1,
              filter: 'drop-shadow(0 0 32px rgba(59,130,246,0.9)) drop-shadow(0 0 64px rgba(59,130,246,0.4))',
              animation: splashPhase === 'entering'
                ? 'logoEnter 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards'
                : 'logoFloat 2.5s ease-in-out infinite',
              position: 'relative',
              zIndex: 1,
            }}>
              🛡️
            </div>
          </div>

          {/* Brand name */}
          <div style={{
            marginTop: 28,
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: '-0.04em',
            color: '#f1f5f9',
            opacity: splashPhase === 'entering' ? 0 : 1,
            transform: splashPhase === 'entering' ? 'translateY(12px)' : 'translateY(0)',
            transition: 'opacity 0.5s ease 0.3s, transform 0.5s ease 0.3s',
          }}>
            Deploy<span style={{ color: '#3b82f6' }}>Guard</span>
          </div>

          {/* Tagline */}
          <div style={{
            marginTop: 10,
            fontSize: 13,
            color: '#475569',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            fontWeight: 600,
            opacity: splashPhase === 'entering' ? 0 : 1,
            transition: 'opacity 0.5s ease 0.5s',
          }}>
            Performance Regression Detection
          </div>

          {/* Scanning bar */}
          <div style={{
            marginTop: 40,
            width: 200,
            height: 2,
            background: 'rgba(30,45,74,0.5)',
            borderRadius: 4,
            overflow: 'hidden',
            opacity: splashPhase === 'entering' ? 0 : 1,
            transition: 'opacity 0.4s ease 0.6s',
          }}>
            <div style={{
              height: '100%',
              background: 'linear-gradient(90deg, transparent, #3b82f6, transparent)',
              animation: 'scanBar 1.2s ease-in-out infinite',
            }} />
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          LEFT PANEL — center aligned
          ═══════════════════════════════════════ */}
      <div
        className="hidden md:flex flex-1 flex-col justify-center items-center pl-8 pr-8 lg:pl-16 lg:pr-16 border-r border-[#1e2d4a]/80 relative z-10 overflow-hidden text-center"
        style={{
          opacity: splashDone ? 1 : 0,
          transform: splashDone ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.6s ease, transform 0.6s ease',
        }}
      >
        {/* Brand: logo inline next to text — same size */}
        <div className="flex items-center justify-center gap-2.5 mb-5">
          <span
            className="text-2xl leading-none filter drop-shadow-[0_0_16px_rgba(59,130,246,0.6)]"
            style={{ animation: 'logoFloat 3s ease-in-out infinite' }}
          >
            🛡️
          </span>
          <span className="text-2xl font-extrabold tracking-tight text-white leading-none">
            Deploy<span className="text-blue-500">Guard</span>
          </span>
        </div>

        {/* Headline — centered */}
        <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight text-white mb-3">
          Catch performance<br />
          regressions <span className="text-blue-500">before</span><br />
          they hit production.
        </h2>

        {/* Subtitle — centered */}
        <p className="text-slate-400 text-xs lg:text-sm leading-relaxed mb-6 max-w-[420px]">
          DeployGuard baselines bundle size, API latency, and query counts on every PR —
          and uses an NLP engine to explain <em>why</em> a regression happened.
        </p>

        {/* Feature grid — centered */}
        <div className="grid grid-cols-2 gap-3 mb-6 w-full max-w-[480px]">
          {FEATURES.map((f) => (
            <div
              key={f.label}
              className="pt-3.5 pb-3.5 pl-3.5 pr-3.5 bg-[#0f1629]/50 border border-[#1e2d4a]/60 rounded-xl backdrop-blur-sm transition-all hover:bg-blue-500/5 hover:border-blue-500/35 text-left"
            >
              <div className="text-base mb-1.5">{f.icon}</div>
              <div className="text-xs font-bold text-white mb-0.5">{f.label}</div>
              <p className="text-[10px] text-slate-400 leading-normal">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* Stats — centered */}
        <div className="flex justify-center gap-8 lg:gap-12">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-lg lg:text-xl font-extrabold text-blue-500">{s.value}</div>
              <div className="text-[9px] text-slate-500 tracking-widest uppercase font-bold mt-0.5">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════════════════════════
          RIGHT PANEL — login card
          ═══════════════════════════════════════ */}
      <div
        className="w-full md:w-[460px] lg:w-[520px] flex-shrink-0 flex flex-col justify-center items-center pl-6 pr-6 pt-6 pb-6 sm:pl-8 sm:pr-8 relative z-10"
        style={{
          opacity: splashDone ? 1 : 0,
          transform: splashDone ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.6s ease 0.1s, transform 0.6s ease 0.1s',
        }}
      >
        {/* Glassmorphic card */}
        <div className="w-full bg-[#0f1629]/75 border border-[#1e2d4a]/80 rounded-2xl pl-6 pr-6 pt-6 pb-6 lg:pl-8 lg:pr-8 lg:pt-8 lg:pb-8 backdrop-blur-2xl shadow-2xl flex flex-col">

          {/* Card header: logo inline with title */}
          <div className="flex items-center justify-center gap-3 mb-5">
            <span className="text-3xl filter drop-shadow-[0_0_16px_rgba(59,130,246,0.5)]">🛡️</span>
            <div className="text-left">
              <h1 className="text-base lg:text-lg font-extrabold tracking-tight text-white leading-tight">
                Welcome to <span className="text-blue-500">DeployGuard</span>
              </h1>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Sign in to protect your pull requests.
              </p>
            </div>
          </div>

          {/* How it works */}
          <div className="bg-[#070b14]/60 border border-[#1e2d4a]/30 rounded-xl pt-4 pb-4 pl-4 pr-4 mb-5">
            <div className="text-[9px] font-bold text-slate-500 tracking-widest uppercase mb-3">
              How It Works
            </div>
            <div className="flex flex-col gap-3">
              {STEPS.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-6 h-6 flex items-center justify-center text-[9px] font-mono font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-md flex-shrink-0">
                    {s.n}
                  </span>
                  <span className="text-sm flex-shrink-0">{s.icon}</span>
                  <span className="text-xs text-slate-300 font-medium leading-tight">{s.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* GitHub button */}
          <button
            id="github-login-btn"
            onClick={handleLogin}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 active:scale-95 text-white rounded-xl font-bold shadow-[0_4px_20px_rgba(59,130,246,0.35)] transition-all duration-200 cursor-pointer"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" className="flex-shrink-0">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
            Continue with GitHub
          </button>

          <p className="text-center text-[10px] text-slate-500 mt-3 leading-normal pl-2 pr-2">
            By signing in you agree to install the DeployGuard GitHub App on selected repositories.
          </p>
        </div>

        <p className="text-center text-[10px] text-slate-500 mt-4">
          Built by <span className="text-slate-300 font-semibold">Saksham Hans</span> · Node.js · Python · React
        </p>
      </div>
    </div>
  );
}
