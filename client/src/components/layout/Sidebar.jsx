import { NavLink } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';

const LINKS = {
  government_officer: [
    ['/dashboard', 'Dashboard'],
    ['/projects', 'Projects'],
    ['/tenders', 'Tenders'],
  ],
  contractor: [
    ['/dashboard', 'Dashboard'],
    ['/projects', 'My Projects'],
    ['/tenders', 'My Tenders'],
    ['/milestones', 'My Milestones'],
  ],
  auditor: [
    ['/dashboard', 'Dashboard'],
    ['/projects', 'Projects'],
    ['/tenders', 'Tenders'],
    ['/milestones', 'Milestones'],
  ],
};

export default function Sidebar({ open, onClose }) {
  const { user, logout } = useAuth();

  const links = LINKS[user.role] || LINKS.auditor;
  const consoleLabel =
    user.role === 'government_officer'
      ? 'Officer console'
      : user.role === 'contractor'
        ? 'Contractor workbench'
        : 'Audit console';

  const itemClass = ({ isActive }) =>
    `relative flex items-center justify-between px-3 py-2 rounded text-sm font-medium transition-all duration-200 overflow-hidden gc-interactive ${
      isActive ? 'bg-white/10 text-white' : 'text-gray-300 hover:bg-white/5 hover:text-white'
    }`;

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onClose} aria-hidden="true" />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 flex flex-col transform transition-transform duration-200 lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ background: 'rgba(11, 33, 64, 0.85)', backdropFilter: 'blur(10px)' }}
      >
        <div style={{ height: 3, background: 'var(--gc-amber)' }} />
        <div className="px-4 py-4">
          <span className="gc-wordmark text-white text-lg">GovChain</span>
          <p className="text-gray-400 text-xs mt-1">{consoleLabel}</p>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {links.map(([to, label], idx) => (
            <NavLink key={to} to={to} className={itemClass} onClick={onClose}>
              {({ isActive }) => (
                <>
                  {/* Animated Left Border indicator */}
                  <span
                    className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-md transition-all duration-300 ease-out bg-[var(--gc-amber)] ${
                      isActive ? 'h-3/4 opacity-100 scale-y-100' : 'h-0 opacity-0 scale-y-0'
                    }`}
                  />
                  <span className={`gc-animate-entrance gc-stagger-${Math.min(idx + 1, 5)} relative z-10`}>
                    {label}
                  </span>
                  <span
                    className={`transition-transform duration-300 relative z-10 ${
                      isActive ? 'translate-x-0.5 text-white' : 'text-gray-500'
                    }`}
                  >
                    ›
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-4 py-4 border-t space-y-3" style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
          {user.role === 'auditor' && <span className="gc-readonly">● Read only</span>}
          <button
            type="button"
            onClick={logout}
            className="w-full gc-btn gc-btn-outline gc-btn-sm justify-center gc-interactive"
            style={{ color: '#e2e8f0', borderColor: 'rgba(255,255,255,0.25)' }}
          >
            Log out
          </button>
        </div>
      </aside>
    </>
  );
}