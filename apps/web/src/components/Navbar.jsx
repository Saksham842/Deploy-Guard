import { Link, useNavigate, useLocation } from 'react-router-dom';
import GsapMagnetic from './GsapMagnetic';

export default function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const username = localStorage.getItem('dg_username');
  const avatar = localStorage.getItem('dg_avatar');

  function handleLogout() {
    localStorage.clear();
    navigate('/login');
  }

  const isReposActive = location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/repo');
  const isDocsActive = location.pathname === '/docs';

  return (
    <nav className="bg-[#08090C]/85 backdrop-blur-xl border-b border-white/[0.08] px-6 sm:px-8 h-[60px] flex items-center justify-between sticky top-0 z-50">
      
      {/* Brand logo and link */}
      <div className="flex items-center gap-6">
        <GsapMagnetic strength={0.15}>
          <Link to="/dashboard" className="flex items-center gap-2 no-underline group">
            <span className="text-lg select-none group-hover:scale-110 transition-transform">🛡️</span>
            <span className="font-extrabold text-sm tracking-tight text-white">
              Deploy<span className="text-gradient-violet">Guard</span>
            </span>
          </Link>
        </GsapMagnetic>

        {/* Live Cluster Status Beacon (Render Style) */}
        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-mono">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
          </span>
          <span>US-East Runner: Operational</span>
        </div>
      </div>

      {/* Nav Actions */}
      <div className="flex items-center gap-2 sm:gap-4">
        <Link
          to="/dashboard"
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            isReposActive
              ? 'bg-violet-500/15 text-violet-300 border border-violet-500/30'
              : 'text-[#9CA3AF] hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          Repositories
        </Link>
        <Link
          to="/docs"
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            isDocsActive
              ? 'bg-violet-500/15 text-violet-300 border border-violet-500/30'
              : 'text-[#9CA3AF] hover:text-white hover:bg-white/[0.04]'
          }`}
        >
          Documentation
        </Link>
        
        {username && (
          <div className="flex items-center gap-3 pl-3 ml-2 border-l border-white/[0.1]">
            {avatar && (
              <img
                src={avatar}
                alt={username}
                className="w-7 h-7 rounded-full border border-violet-500/40 ring-2 ring-violet-500/20"
              />
            )}
            <span className="text-white text-xs font-mono font-medium hidden sm:inline">
              {username}
            </span>
            <GsapMagnetic strength={0.2}>
              <button
                onClick={handleLogout}
                className="px-2.5 py-1 border border-white/[0.1] hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400 rounded-lg text-[11px] font-mono text-[#9CA3AF] bg-transparent transition-all cursor-pointer"
              >
                Sign out
              </button>
            </GsapMagnetic>
          </div>
        )}
      </div>

    </nav>
  );
}
