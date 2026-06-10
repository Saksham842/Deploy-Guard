import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import RepoDetail from './pages/RepoDetail'
import Settings from './pages/Settings'
import AuthCallback from './pages/AuthCallback'
import Docs from './pages/Docs'
import Navbar from './components/Navbar'
import './index.css'

function PrivateRoute({ children }) {
  const token = localStorage.getItem('dg_token')
  return token ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/*"
          element={
            <div className="min-h-screen flex flex-col bg-[#070b14]">
              <Navbar />
              <main className="flex-1 p-6 sm:p-8 max-w-[1200px] mx-auto w-full relative">
                <Routes>
                  <Route path="/" element={<Navigate to="/dashboard" replace />} />
                  <Route path="/docs" element={<Docs />} />
                  <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
                  <Route path="/repo/:owner/:name" element={<PrivateRoute><RepoDetail /></PrivateRoute>} />
                  <Route path="/repo/:owner/:name/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
                </Routes>
              </main>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
