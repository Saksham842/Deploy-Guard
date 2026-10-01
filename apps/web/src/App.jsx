import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import LocomotiveScroll from 'locomotive-scroll';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RepoDetail from './pages/RepoDetail';
import Settings from './pages/Settings';
import AuthCallback from './pages/AuthCallback';
import Docs from './pages/Docs';
import Navbar from './components/Navbar';
import './index.css';

function PrivateRoute({ children }) {
  const token = localStorage.getItem('dg_token');
  return token ? children : <Navigate to="/login" replace />;
}

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        className="w-full"
      >
        <Routes location={location}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/repo/:owner/:name" element={<PrivateRoute><RepoDetail /></PrivateRoute>} />
          <Route path="/repo/:owner/:name/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  );
}

export default function App() {
  useEffect(() => {
    // Initialize Locomotive smooth inertial scroll
    let locomotiveScroll;
    try {
      locomotiveScroll = new LocomotiveScroll({
        lenisOptions: {
          lerp: 0.1,
          duration: 1.2,
          smoothWheel: true,
        },
      });
    } catch {
      // Graceful fallback if window or DOM not ready
    }

    return () => {
      if (locomotiveScroll && typeof locomotiveScroll.destroy === 'function') {
        locomotiveScroll.destroy();
      }
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/*"
          element={
            <div className="min-h-screen flex flex-col bg-[#0D0F12] text-[#E8EAED]">
              <Navbar />
              <main className="flex-1 p-6 sm:p-8 max-w-[1240px] mx-auto w-full relative">
                <AnimatedRoutes />
              </main>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
