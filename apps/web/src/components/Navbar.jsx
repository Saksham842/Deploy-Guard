import { Link, useNavigate } from 'react-router-dom';
import GsapMagnetic from './GsapMagnetic';

export default function Navbar() {
  const navigate = useNavigate();
  const username = localStorage.getItem('dg_username');
  const avatar = localStorage.getItem('dg_avatar');

  function handleLogout() {
    localStorage.clear();
    navigate('/login');
  }

  return (
    <nav className="bg-[#161A1F]/90 backdrop-blur-md border-b border-[#252B32] px-6 h-[54px] flex items-center justify-between sticky top-0 z-50">
      
      {/* Brand logo and link */}
      <GsapMagnetic strength={0.15}>
        <Link to="/dashboard" className="flex items-center gap-2 no-underline">
          <span className="text-lg">🛡️</span>
          <span className="font-bold text-xs tracking-tight text-[#E8EAED]">
            Deploy<span className="text-[#4C8DFF]">Guard</span>
          </span>
        </Link>
      </GsapMagnetic>

      {/* Nav Actions */}
      <div className="flex items-center gap-5">
        <Link
          to="/dashboard?setup=true"
          className="text-[#8B92A0] hover:text-[#E8EAED] no-underline text-xs transition-colors"
        >
          Setup guide
        </Link>
        <Link
          to="/docs"
          className="text-[#8B92A0] hover:text-[#E8EAED] no-underline text-xs transition-colors"
        >
          Documentation
        </Link>
        <Link
          to="/dashboard"
          className="text-[#8B92A0] hover:text-[#E8EAED] no-underline text-xs transition-colors"
        >
          Repositories
        </Link>
        
        {username && (
          <div className="flex items-center gap-3 pl-3 border-l border-[#252B32]">
            {avatar && (
              <img
                src={avatar}
                alt={username}
                className="w-6 h-6 rounded-full border border-[#252B32]"
              />
            )}
            <span className="text-[#8B92A0] text-xs font-mono hidden sm:inline">
              {username}
            </span>
            <GsapMagnetic strength={0.2}>
              <button
                onClick={handleLogout}
                className="px-2 py-1 border border-[#252B32] hover:border-[#38424E] rounded text-[11px] font-mono text-[#8B92A0] hover:text-[#E8EAED] bg-transparent transition-colors cursor-pointer"
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
