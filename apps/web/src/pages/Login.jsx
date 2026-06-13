import { useEffect, useState } from 'react';
import ParticleBackground from '../components/ParticleBackground';



const FEATURES = [
  { label: 'Bundle Size Control', desc: 'Auto-scan compilation builds and block bundles exceeding size gates.' },
  { label: 'Latency Regression Alert', desc: 'Detect performance spikes in API endpoints via p95 response time metrics.' },
  { label: 'Database Query Guard', desc: 'Audit DB query frequencies to catch N+1 query patterns and unbound fetch loops.' },
  { label: 'Hybrid NLP Diagnostics', desc: 'Categorize commit history into semantic categories to explain delta causes.' },
];

const STEPS = [
  { n: '01', text: 'Developer submits a Pull Request, initiating the webhook run.' },
  { n: '02', text: 'GitHub Action compiles code and uploads size and build metadata.' },
  { n: '03', text: 'DeployGuard compares metrics against historical branch baselines.' },
  { n: '04', text: 'NLP pipeline classifies commit text and publishes check reports.' },
];

const STATS = [
  { value: '10', label: 'NLP Classes' },
  { value: '3-Tier', label: 'Cascade' },
  { value: '<50ms', label: 'Inference' },
  { value: 'V2', label: 'Classifier' },
];

export default function Login() {
  const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

  // Splash intro phases: 'entering' -> 'pulsing' -> 'exiting' -> 'done'
  const [splashPhase, setSplashPhase] = useState('entering');

  useEffect(() => {
    const t1 = setTimeout(() => setSplashPhase('pulsing'), 600);
    const t2 = setTimeout(() => setSplashPhase('exiting'), 1800);
    const t3 = setTimeout(() => setSplashPhase('done'), 2300);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  // Prevent parent scrollbars and jitter while the splash screen is loading/exiting
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100%';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.height = '100%';
    return () => {
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

      {/* Splash intro wrapper */}
      {!splashDone && (
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#070b14] transition-all duration-500"
          style={{
            opacity: splashExiting ? 0 : 1,
            transform: splashExiting ? 'scale(0.88) translateY(-24px)' : 'scale(1) translateY(0)',
            filter: splashExiting ? 'blur(8px)' : 'blur(0px)',
          }}
        >
          {/* Animated glow ring */}
          <div className="relative flex items-center justify-center">
            <div
              className="absolute rounded-full border border-blue-500/25 animate-[ringPulse_1.4s_ease-out_infinite]"
              style={{ width: 160, height: 160 }}
            />
            <div
              className="absolute rounded-full border border-blue-500/12 animate-[ringPulse_1.4s_ease-out_0.3s_infinite]"
              style={{ width: 200, height: 200 }}
            />
            <div
              className="absolute rounded-full border border-blue-500/6 animate-[ringPulse_1.4s_ease-out_0.6s_infinite]"
              style={{ width: 250, height: 250 }}
            />

            <div
              className="absolute rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.22)_0%,transparent_70%)] animate-[glowPulse_1.4s_ease-in-out_infinite]"
              style={{ width: 110, height: 110 }}
            />

            <div
              className="text-[72px] leading-none filter drop-shadow-[0_0_32px_rgba(59,130,246,0.9)] drop-shadow-[0_0_64px_rgba(59,130,246,0.4)] relative z-10"
              style={{
                animation: splashPhase === 'entering'
                  ? 'logoEnter 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards'
                  : 'logoFloat 2.5s ease-in-out infinite',
              }}
            >
              🛡️
            </div>
          </div>

          {/* Brand branding */}
          <div
            className="mt-7 text-3xl font-extrabold tracking-tight text-slate-100 transition-all duration-500"
            style={{
              opacity: splashPhase === 'entering' ? 0 : 1,
              transform: splashPhase === 'entering' ? 'translateY(12px)' : 'translateY(0)',
              transitionDelay: '0.3s',
            }}
          >
            Deploy<span className="text-blue-500">Guard</span>
          </div>

          <div
            className="mt-2.5 text-xs text-slate-500 tracking-widest uppercase font-semibold transition-all duration-500"
            style={{
              opacity: splashPhase === 'entering' ? 0 : 1,
              transitionDelay: '0.5s',
            }}
          >
            Performance Regression Detection
          </div>

          {/* Glowing scan bar */}
          <div
            className="mt-10 w-[200px] h-0.5 bg-slate-800/50 rounded-full overflow-hidden transition-all duration-500"
            style={{
              opacity: splashPhase === 'entering' ? 0 : 1,
              transitionDelay: '0.6s',
            }}
          >
            <div className="h-full bg-gradient-to-r from-transparent via-blue-500 to-transparent animate-[scanBar_1.2s_ease-in-out_infinite]" />
          </div>
        </div>
      )}

      {/* Main content view */}
      <div
        className="hidden md:flex flex-1 flex-col justify-center items-center px-8 lg:px-16 border-r border-[#1e2d4a]/80 relative z-10 overflow-hidden text-center transition-all duration-[600ms]"
        style={{
          opacity: splashDone ? 1 : 0,
          transform: splashDone ? 'translateY(0)' : 'translateY(20px)',
        }}
      >
        <div className="flex items-center justify-center gap-2.5 mb-5">
          <span
            className="text-2xl leading-none filter drop-shadow-[0_0_16px_rgba(59,130,246,0.6)] animate-[logoFloat_3s_ease-in-out_infinite]"
          >
            🛡️
          </span>
          <span className="text-2xl font-extrabold tracking-tight text-white leading-none">
            Deploy<span className="text-blue-500">Guard</span>
          </span>
        </div>

        <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight text-white mb-3">
          Catch performance<br />
          regressions <span className="text-blue-500">before</span><br />
          they hit production.
        </h2>

        <p className="text-slate-400 text-xs lg:text-sm leading-relaxed mb-8 max-w-[420px]">
          Configure automated performance quality gates in your CI pipelines. DeployGuard monitors codebases for regressions and diagnoses roots using local NLP sentence-transformers.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-8 w-full max-w-[480px]">
          {FEATURES.map((f) => (
            <div
              key={f.label}
              className="p-4 bg-[#0f1629]/50 border-l-2 border-l-blue-500 border-y border-r border-[#1e2d4a]/40 rounded-xl backdrop-blur-sm transition-all hover:bg-[#1e2d4a]/20 hover:border-blue-500/30 text-left"
            >
              <div className="text-xs font-bold text-white mb-1">{f.label}</div>
              <p className="text-[10px] text-slate-400 leading-normal">{f.desc}</p>
            </div>
          ))}
        </div>

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

      <div
        className="w-full md:w-[460px] lg:w-[520px] flex-shrink-0 flex flex-col justify-center items-center p-6 sm:p-8 relative z-10 transition-all duration-[600ms] delay-100"
        style={{
          opacity: splashDone ? 1 : 0,
          transform: splashDone ? 'translateY(0)' : 'translateY(20px)',
        }}
      >
        <div className="w-full bg-[#0f1629]/75 border border-[#1e2d4a]/80 rounded-2xl p-6 lg:p-8 backdrop-blur-2xl shadow-2xl flex flex-col">
          <div className="flex items-center justify-center gap-3 mb-5">
            <span className="text-3xl filter drop-shadow-[0_0_16px_rgba(59,130,246,0.5)]">🛡️</span>
            <div className="text-left">
              <h1 className="text-base lg:text-lg font-extrabold tracking-tight text-white leading-tight">
                Welcome to <span className="text-blue-500">DeployGuard</span>
              </h1>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Sign in to manage and authorize performance gates.
              </p>
            </div>
          </div>

          <div className="bg-[#070b14]/60 border border-[#1e2d4a]/30 rounded-xl p-4 mb-5">
            <div className="text-[9px] font-bold text-slate-500 tracking-widest uppercase mb-3">
              How It Works
            </div>
            <div className="flex flex-col gap-3">
              {STEPS.map((s, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-6 h-6 flex items-center justify-center text-[9px] font-mono font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-md flex-shrink-0">
                    {s.n}
                  </span>
                  <span className="text-xs text-slate-300 font-medium leading-tight">{s.text}</span>
                </div>
              ))}
            </div>
          </div>

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

          <p className="text-center text-[10px] text-slate-500 mt-3 leading-normal px-2">
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
