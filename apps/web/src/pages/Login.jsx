import { motion } from 'framer-motion';
import ThreeCanvas from '../components/ThreeCanvas';
import GsapMagnetic from '../components/GsapMagnetic';

export default function Login() {
  const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

  function handleLogin() {
    window.location.href = `${API_URL}/api/auth/github`;
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between tech-grid-bg text-[#F3F4F6] font-sans overflow-hidden">
      
      {/* Ambient Render-style Radial Aurora Glows */}
      <div className="glow-orb-violet -top-40 -left-20" />
      <div className="glow-orb-cyan -bottom-40 -right-20" />

      {/* Top minimal brand bar */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative z-10 px-6 sm:px-10 py-4 flex items-center justify-between border-b border-white/[0.07] bg-[#08090C]/75 backdrop-blur-xl"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-[0_0_16px_rgba(124,58,237,0.5)]">
            <span className="text-base">🛡️</span>
          </div>
          <div>
            <span className="font-extrabold text-sm tracking-tight text-white">
              Deploy<span className="text-gradient-violet">Guard</span>
            </span>
            <span className="hidden sm:inline-block ml-2.5 px-2 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/25 text-violet-300 text-[10px] font-mono font-medium tracking-wide">
              v2.0 · Performance Gate
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Gateways Active</span>
          </div>
          <a
            href="https://github.com/Saksham842/Deploy-Guard"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-[#9CA3AF] hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/[0.08] hover:border-white/[0.2] bg-white/[0.03]"
          >
            GitHub ↗
          </a>
        </div>
      </motion.header>

      {/* Main hero showcase container */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-6 my-auto">
        <div className="w-full max-w-[1120px] grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Left panel: Render Developer Cloud Hero with 3D Canvas */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="lg:col-span-7 flex flex-col justify-between relative"
          >
            <div>
              {/* Render-style Pill Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-violet-500/15 via-indigo-500/15 to-cyan-500/15 border border-violet-500/30 text-violet-300 text-xs font-mono mb-4 backdrop-blur-md">
                <span className="text-amber-400">⚡</span>
                <span className="font-semibold tracking-wide">CI/CD BUNDLE & QUERY REGRESSION GUARD</span>
              </div>

              {/* Bold Gradient Title */}
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-[1.15] mb-4">
                Ship at lightspeed. <br />
                <span className="text-gradient-violet">Zero regressions.</span>
              </h1>

              <p className="text-sm text-[#9CA3AF] leading-relaxed mb-6 max-w-[500px]">
                DeployGuard intercepts pull requests before they hit staging. Detect bundle chunk bloat, unindexed SQL queries, and API latency spikes with automated setup PRs and ML diagnostics.
              </p>
            </div>

            {/* Simulated Live CI Telemetry Terminal */}
            <div className="relative rounded-xl border border-white/[0.1] bg-[#0D1017]/90 backdrop-blur-xl shadow-[0_20px_40px_rgba(0,0,0,0.5)] overflow-hidden">
              {/* Top window bar */}
              <div className="px-4 py-2.5 bg-[#151922] border-b border-white/[0.08] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                  <span className="text-[11px] font-mono text-[#9CA3AF] ml-2">check-run: pull/42 (deployguard.yml)</span>
                </div>
                <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/30">
                  LIVE RUNNER
                </span>
              </div>

              {/* Terminal body with Three.js Hologram floating in corner */}
              <div className="p-4 font-mono text-xs space-y-2 relative">
                <div className="absolute top-1 right-1 w-32 h-32 opacity-75 pointer-events-none">
                  <ThreeCanvas />
                </div>

                <div className="flex items-center gap-2 text-[#9CA3AF]">
                  <span className="text-violet-400">commit</span>
                  <span className="text-white bg-white/[0.08] px-1.5 py-0.5 rounded">9da54b0</span>
                  <span className="text-emerald-400 font-semibold">(feature/smart-bundle-split)</span>
                </div>

                <div className="flex items-center gap-2 text-cyan-300">
                  <span className="text-cyan-400">✓</span>
                  <span>Detected Vite 5.4 · Normalized 34 chunks</span>
                </div>

                <div className="flex items-center gap-2 text-emerald-400">
                  <span className="text-emerald-400">✓</span>
                  <span>Bundle size: <strong>342.1 KB</strong> (-18.4 KB / -5.1% under threshold)</span>
                </div>

                <div className="flex items-center gap-2 text-indigo-300">
                  <span className="text-indigo-400">✓</span>
                  <span>Database tracking: <strong>14 queries</strong> (baseline: 18)</span>
                </div>

                <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>CHECK RUN PASSED (840ms)</span>
                  </div>
                  <span className="text-[#9CA3AF]">GitHub Status API: 200 OK</span>
                </div>
              </div>
            </div>

            {/* Bottom mini metric tags */}
            <div className="mt-5 flex items-center gap-5 text-xs font-mono text-[#9CA3AF]">
              <div className="flex items-center gap-1.5">
                <span className="text-violet-400">●</span>
                <span>Vite · Next.js · Webpack</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-cyan-400">●</span>
                <span>Groq LLaMA 3.1 AI</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-emerald-400">●</span>
                <span>Zero build latency</span>
              </div>
            </div>
          </motion.div>

          {/* Right panel: Render-Grade Focused Sign-in Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay: 0.15 }}
            className="lg:col-span-5 relative"
          >
            {/* Top gradient glow border */}
            <div className="relative rounded-2xl bg-[#0F1219]/90 border border-white/[0.1] backdrop-blur-2xl p-7 lg:p-9 shadow-[0_25px_60px_rgba(0,0,0,0.7)] overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400" />
              
              <div className="mb-6">
                <div className="text-[11px] font-mono uppercase tracking-wider text-violet-400 font-semibold mb-1">
                  Developer Portal
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Connect your workspace
                </h2>
                <p className="text-xs text-[#9CA3AF] mt-1.5 leading-relaxed">
                  Authenticate with GitHub to access repository telemetry, customize performance budgets, and review automated PR diagnostics.
                </p>
              </div>

              {/* GSAP Magnetic GitHub Button with Render Gradient */}
              <div className="w-full mb-6">
                <GsapMagnetic strength={0.3} className="w-full">
                  <button
                    id="github-login-btn"
                    onClick={handleLogin}
                    className="w-full flex items-center justify-center gap-3 py-3 px-5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 shadow-[0_0_25px_rgba(124,58,237,0.45)] hover:shadow-[0_0_35px_rgba(124,58,237,0.7)] transition-all duration-200 cursor-pointer"
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" className="flex-shrink-0">
                      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                    </svg>
                    Continue with GitHub
                  </button>
                </GsapMagnetic>
              </div>

              {/* Feature Points */}
              <div className="space-y-3 pt-5 border-t border-white/[0.08] text-xs">
                <div className="flex items-center gap-2.5 text-[#E5E7EB]">
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">✓</span>
                  <span>Instant automated setup PR on repository install</span>
                </div>
                <div className="flex items-center gap-2.5 text-[#E5E7EB]">
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-bold">✓</span>
                  <span>Zero code leaves your runner · only stats dictionary</span>
                </div>
                <div className="flex items-center gap-2.5 text-[#E5E7EB]">
                  <span className="flex items-center justify-center w-4 h-4 rounded-full bg-violet-500/20 text-violet-400 text-[10px] font-bold">✓</span>
                  <span>GitHub Check Run status & inline PR comment annotations</span>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-white/[0.08] text-[11px] font-mono text-[#9CA3AF] text-center">
                Free Developer Tier · No credit card required
              </div>
            </div>
          </motion.div>

        </div>
      </main>

      {/* Clean Render-style minimal footer */}
      <footer className="relative z-10 px-8 py-4 border-t border-white/[0.07] flex items-center justify-between text-xs text-[#9CA3AF] font-mono bg-[#08090C]/80 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>DeployGuard Systems 100% Operational</span>
        </div>
        <span>Built with Node · Python · React · Three.js</span>
      </footer>
    </div>
  );
}
