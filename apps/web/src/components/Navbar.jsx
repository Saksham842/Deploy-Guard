import { Link, useNavigate } from 'react-router-dom';

export default function Navbar() {
  const navigate = useNavigate();
  const username = localStorage.getItem('dg_username');
  const avatar = localStorage.getItem('dg_avatar');

  function handleLogout() {
    localStorage.clear();
    navigate('/login');
  }

  return (
    <nav className="bg-[#0f1629]/95 border-b border-[#1e2d4a]/80 px-6 sm:px-8 h-[60px] flex items-center justify-between sticky top-0 z-50 backdrop-blur-md">
      
      {/* Brand logo and link */}
      <Link to="/dashboard" className="flex items-center gap-2 no-underline">
        <span className="text-xl">🛡️</span>
        <span className="font-extrabold text-sm text-white tracking-tight">
          Deploy<span className="text-blue-500">Guard</span>
        </span>
      </Link>

      {/* Nav Actions */}
      <div className="flex items-center gap-6">
        <Link
          to="/docs"
          className="text-slate-400 hover:text-white no-underline text-xs font-semibold tracking-wide transition-colors"
        >
          How it works
        </Link>
        <Link
          to="/dashboard"
          className="text-slate-400 hover:text-white no-underline text-xs font-semibold tracking-wide transition-colors"
        >
          Dashboard
        </Link>
        
        {username && (
          <div className="flex items-center gap-3 pl-3 border-l border-[#1e2d4a]/80">
            {avatar && (
              <img
                src={avatar}
                alt={username}
                className="w-7 h-7 rounded-full border border-[#1e2d4a]/85"
              />
            )}
            <span className="text-slate-400 text-xs font-medium hidden sm:inline">
              {username}
            </span>
            <button
              onClick={handleLogout}
              className="px-2.5 py-1.5 border border-[#1e2d4a]/85 hover:border-blue-500/80 rounded-lg text-[10px] font-bold text-slate-400 hover:text-white bg-transparent transition-all hover:bg-[#141d35] cursor-pointer"
            >
              Sign out
            </button>
          </div>
        )}
      </div>

    </nav>
  );
}
