import { Link } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col relative" style={{ background: 'transparent' }}>
      <header className="relative z-50 bg-[#0b2140] w-full">
        <div className="h-1 w-full bg-[#a56b12]" />
        <div className="max-w-6xl mx-auto px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <span className="text-2xl font-bold tracking-tight text-white flex items-center">
            GovChain
          </span>
          <nav className="flex flex-wrap items-center gap-3">
            {user ? (
              <>
                <Link
                  to="/dashboard"
                  className="px-4 py-2 rounded text-sm font-medium bg-transparent text-white border border-white/30 hover:bg-white/10 transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  to="/projects"
                  className="px-4 py-2 rounded text-sm font-medium bg-transparent text-white border border-white/30 hover:bg-white/10 transition-colors"
                >
                  Projects
                </Link>
                <button 
                  type="button" 
                  onClick={logout} 
                  className="px-4 py-2 rounded text-sm font-medium bg-[#8f2f26] text-white hover:bg-[#6c1c14] border border-[#8f2f26] transition-colors"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  className="px-4 py-2 rounded text-sm font-medium bg-transparent text-white border border-white/30 hover:bg-white/10 transition-colors"
                >
                  Log in
                </Link>
                <Link 
                  to="/register" 
                  className="px-4 py-2 rounded text-sm font-medium bg-[#0057D9] text-white hover:bg-[#0042a6] border border-[#0057D9] transition-colors"
                >
                  Register
                </Link>
                <Link
                  to="/health"
                  className="px-4 py-2 rounded text-sm font-medium bg-transparent text-white border border-white/30 hover:bg-white/10 transition-colors hidden sm:block"
                >
                  System health
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-16 sm:py-24 md:py-32 flex flex-col justify-center relative z-10">
        <p className="text-sm md:text-base font-bold uppercase tracking-[0.15em] text-[#38BDF8] mb-4">
          Transparent government project spending &amp; procurement
        </p>
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight" style={{ lineHeight: 1.15 }}>
          Public infrastructure, <br className="hidden sm:block" />
          planned and accounted for.
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-gray-200 mt-6 max-w-2xl leading-relaxed">
          GovChain connects government officers, contractors and auditors around
          projects, tenders and milestones — from planning to execution with fully transparent immutable tracking.
        </p>

        <div className="flex flex-wrap items-center gap-4 mt-10">
          <Link
            to="/register"
            className="inline-flex items-center justify-center px-6 py-3 text-base md:text-lg font-semibold rounded bg-[#0057D9] text-white hover:bg-[#0042a6] border border-[#0057D9] shadow-sm transition-colors"
          >
            Create an Account
          </Link>
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center px-6 py-3 text-base md:text-lg font-semibold rounded bg-white text-[#0057D9] hover:bg-[#f5f8fc] border border-[#0057D9] shadow-sm transition-colors"
          >
            Access Console
          </Link>
        </div>


        <div className="grid md:grid-cols-3 gap-4 mt-10">
          {[
            ['Officer console', 'Bid, award and manage government projects and tenders.'],
            ['Contractor workbench', 'Track the work assigned to you, milestone by milestone.'],
            ['Audit console', 'Examine projects, tenders and milestone records read-only.'],
          ].map(([title, body], index) => (
            <div
              key={title}
              className="bg-white rounded-lg shadow-md p-6 relative overflow-hidden transition-transform duration-200 hover:-translate-y-1"
              style={{ borderTopWidth: 4, borderStyle: 'solid', borderColor: '#0057D9' }}
            >
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Role 0{index + 1}</p>
              <h2 className="text-xl font-bold text-gray-900 mt-2">{title}</h2>
              <p className="text-base text-gray-600 mt-3 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="mt-auto relative z-20" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[rgba(255,255,255,0.7)]">
          <span>GovChain — Stage 1 prototype</span>
          <Link to="/health" className="hover:text-white transition-colors underline underline-offset-2">System health</Link>
        </div>
      </footer>
    </div>
  );
}