import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinkClass = ({ isActive }) =>
    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      isActive
        ? 'bg-blue-700 text-white shadow-xs'
        : 'text-slate-300 hover:bg-slate-700 hover:text-white'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Top Navigation Bar */}
      <header className="bg-slate-900 border-b border-slate-800 text-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Nav links */}
            <div className="flex items-center space-x-8">
              <span className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-black text-sm">
                  KF
                </span>
                KnowFlow AI
              </span>

              <nav className="flex space-x-2">
                <NavLink to="/documents" className={navLinkClass}>
                  Documents
                </NavLink>
                <NavLink to="/chat" className={navLinkClass}>
                  Chat
                </NavLink>
              </nav>
            </div>

            {/* User Info & Logout */}
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-slate-300">
                <span className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold text-white uppercase">
                  {user?.username ? user.username[0] : 'U'}
                </span>
                <span className="font-medium text-slate-200">{user?.username}</span>
              </div>

              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-md text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700 transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Outlet />
      </main>
    </div>
  );
}
