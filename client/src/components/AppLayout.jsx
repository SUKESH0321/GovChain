import { Link, NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

// Shared authenticated layout: role-aware top navigation + page content.
export default function AppLayout() {
  const { user, logout } = useAuth();

  let links = [];
  if (user.role === 'government_officer') {
    links = [
      { to: '/dashboard', label: 'Dashboard' },
      { to: '/projects', label: 'Projects' },
      { to: '/tenders', label: 'Tenders' },
    ];
  } else if (user.role === 'contractor') {
    links = [
      { to: '/dashboard', label: 'Dashboard' },
      { to: '/projects', label: 'My Projects' },
      { to: '/tenders', label: 'My Tenders' },
      { to: '/milestones', label: 'My Milestones' },
    ];
  } else {
    links = [
      { to: '/dashboard', label: 'Dashboard' },
      { to: '/projects', label: 'Projects' },
      { to: '/tenders', label: 'Tenders' },
      { to: '/milestones', label: 'Milestones' },
    ];
  }

  const navItemClassName = ({ isActive }) =>
    isActive ? 'text-blue-300 font-medium' : 'text-gray-300 hover:text-blue-200';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-slate-800 text-white">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link to="/dashboard" className="font-bold text-white">
            GovChain
          </Link>
          <nav className="flex items-center space-x-4 text-sm">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} className={navItemClassName}>
                {link.label}
              </NavLink>
            ))}
            <span className="text-gray-400">
              {user.name} ({user.role.replace('_', ' ')})
            </span>
            <button
              type="button"
              onClick={logout}
              className="bg-red-600 text-white px-3 py-1.5 rounded hover:bg-red-700"
            >
              Logout
            </button>
          </nav>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}