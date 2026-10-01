import ParticleBackground from '../components/ParticleBackground';

export default function Login() {
  const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');

  function handleLogin() {
    window.location.href = `${API_URL}/api/auth/github`;
  }

  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between bg-[#0D0F12] text-[#E8EAED] font-sans overflow-hidden">
      <ParticleBackground />

      {/* Top minimal brand bar */}
      <header className="relative z-10 px-8 py-6 flex items-center justify-between border-b border-[#252B32]/60">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🛡️</span>
          <span className="font-bold text-sm tracking-tight text-[#E8EAED]">
            Deploy<span className="text-[#4C8DFF]">Guard</span>
          </span>
          <span className="text-[10px] font-mono uppercase bg-[#161A1F] border border-[#252B32] text-[#8B92A0] px-1.5 py-0.5 rounded ml-1">
            CI Quality Gates
          </span>
        </div>
        <a
          href="https://github.com/Saksham842/Deploy-Guard"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-mono text-[#8B92A0] hover:text-[#E8EAED] transition-colors"
        >
          GitHub ↗
        </a>
      </header>

      {/* Main technical content container */}
      <main className="relative z-10 flex-1 flex items-center justify-center p-6 my-auto">
        <div className="w-full max-w-[960px] grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          
          {/* Left panel: Technical value proposition & pipeline overview */}
          <div className="md:col-span-7 bg-[#161A1F] border border-[#252B32] rounded-lg p-6 lg:p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-[#8B92A0] mb-3">
                <span className="w-2 h-2 rounded-full bg-[#3DD68C]" />
                <span>Automated Performance CI/CD</span>
              </div>
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-[#E8EAED] leading-tight mb-3">
                Catch performance regressions before merging.
              </h1>
              <p className="text-xs text-[#8B92A0] leading-relaxed mb-6">
                DeployGuard monitors pull requests for bundle bloat, database N+1 query patterns, and API latency spikes. When code changes exceed threshold limits, it fails the check run and posts root-cause diagnostics directly in the review thread.
              </p>

              {/* Technical Capability Specs (replaces generic marketing cards) */}
              <div className="space-y-2.5 border-t border-[#252B32] pt-5">
                <div className="flex items-start gap-3">
                  <span className="font-mono text-xs text-[#4C8DFF] mt-0.5">01</span>
                  <div>
                    <div className="text-xs font-semibold text-[#E8EAED]">Zero-Friction Automated Onboarding</div>
                    <div className="text-[11px] text-[#8B92A0] leading-normal">
                      Auto-detects Vite, Next.js, and Webpack to open a ready-to-merge setup PR on install.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="font-mono text-xs text-[#4C8DFF] mt-0.5">02</span>
                  <div>
                    <div className="text-xs font-semibold text-[#E8EAED]">Multi-Metric Quality Gates</div>
                    <div className="text-[11px] text-[#8B92A0] leading-normal">
                      Guards against bundle size creep and unindexed database queries with configurable limits.
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="font-mono text-xs text-[#4C8DFF] mt-0.5">03</span>
                  <div>
                    <div className="text-xs font-semibold text-[#E8EAED]">Visual Chunk Diff & Trend Recurrence</div>
                    <div className="text-[11px] text-[#8B92A0] leading-normal">
                      Surfaces top chunk deltas and flags recurring regression causes across failing checks.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Terminal telemetry footer */}
            <div className="mt-6 pt-4 border-t border-[#252B32] flex items-center justify-between text-[11px] font-mono text-[#8B92A0]">
              <span>Inference: &lt;50ms (local ML)</span>
              <span>Groq LLaMA 3.1 fallback</span>
              <span>10 NLP classes</span>
            </div>
          </div>

          {/* Right panel: Focused Developer Sign-in */}
          <div className="md:col-span-5 bg-[#161A1F] border border-[#252B32] rounded-lg p-6 lg:p-8 flex flex-col justify-between">
            <div>
              <div className="text-xs font-mono uppercase tracking-wider text-[#8B92A0] mb-1">
                Developer Access
              </div>
              <h2 className="text-lg font-bold text-[#E8EAED] mb-2">
                Connect your account
              </h2>
              <p className="text-xs text-[#8B92A0] leading-relaxed mb-6">
                Authorize DeployGuard through GitHub OAuth to manage repositories, configure threshold gates, and review PR analytics.
              </p>

              <button
                id="github-login-btn"
                onClick={handleLogin}
                className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 bg-[#4C8DFF] hover:bg-[#3A7CE8] text-white rounded text-xs font-semibold transition-colors duration-150 cursor-pointer shadow-sm"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className="flex-shrink-0">
                  <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
                </svg>
                Continue with GitHub
              </button>

              <div className="mt-4 pt-4 border-t border-[#252B32] space-y-2 text-[11px] text-[#8B92A0]">
                <div className="flex items-center gap-2">
                  <span className="text-[#3DD68C]">✓</span>
                  <span>Read-only source access</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#3DD68C]">✓</span>
                  <span>Checks & Pull Requests integration</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#3DD68C]">✓</span>
                  <span>Free tier with zero build-minute usage</span>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-[#8B92A0] pt-4 mt-4 border-t border-[#252B32]">
              Source code builds stay in your runner. DeployGuard only receives build metadata.
            </div>
          </div>

        </div>
      </main>

      {/* Clean minimal footer */}
      <footer className="relative z-10 px-8 py-4 border-t border-[#252B32]/60 flex items-center justify-between text-[11px] text-[#8B92A0] font-mono">
        <span>DeployGuard v2.0</span>
        <span>Built with Node.js · Python · React</span>
      </footer>
    </div>
  );
}
