import { Link } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen" style={{ background: 'transparent' }}>
      <header style={{ background: 'var(--gc-navy)' }}>
        <div style={{ height: 3, background: 'var(--gc-amber)' }} />
        <div className="max-w-4xl mx-auto px-6 py-6 flex items-center justify-between">
          <span className="gc-wordmark text-white text-xl">GovChain</span>
          <nav className="flex items-center gap-3">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="gc-btn gc-btn-outline gc-btn-sm"
                  style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}
                >
                  Dashboard
                </Link>
                <Link
                  to="/projects"
                  className="gc-btn gc-btn-outline gc-btn-sm"
                  style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}
                >
                  Projects
                </Link>
                <button type="button" onClick={logout} className="gc-btn gc-btn-danger gc-btn-sm">
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="gc-btn gc-btn-outline gc-btn-sm"
                  style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}
                >
                  Log in
                </Link>
                <Link to="/register" className="gc-btn gc-btn-primary gc-btn-sm">
                  Register
                </Link>
                <Link
                  to="/health"
                  className="gc-btn gc-btn-outline gc-btn-sm"
                  style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }}
                >
                  System health
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-12">
        <p className="gc-eyebrow">Transparent government project spending &amp; procurement</p>
        <h1 className="text-3xl mt-2 mb-3" style={{ lineHeight: 1.2 }}>
          Public infrastructure, planned and accounted for.
        </h1>
        <p className="text-gray-600 max-w-xl">
          GovChain connects government officers, contractors and auditors around
          projects, tenders and milestones — from planning to execution.
        </p>

        <div className="grid md:grid-cols-3 gap-4 mt-10">
          {[
            ['Officer console', 'Bid, award and manage government projects and tenders.'],
            ['Contractor workbench', 'Track the work assigned to you, milestone by milestone.'],
            ['Audit console', 'Examine projects, tenders and milestone records read-only.'],
          ].map(([title, body], index) => (
            <div
              key={title}
              className="gc-panel p-5"
              style={{ borderTopWidth: 3, borderStyle: 'solid', borderColor: 'var(--gc-navy)' }}
            >
              <p className="gc-eyebrow">Role 0{index + 1}</p>
              <h2 className="text-lg mt-1">{title}</h2>
              <p className="text-sm text-gray-600 mt-1">{body}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t mt-10" style={{ borderColor: 'var(--gc-line)' }}>
        <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between text-xs text-gray-500">
          <span>GovChain — Stage 1 prototype</span>
          <Link to="/health" className="gc-link">System health</Link>
        </div>
      </footer>
    </div>
  );
}