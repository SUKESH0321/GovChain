import { useAuth } from '../../context/AuthContext';

import BlockchainStatusBadge from '../BlockchainStatusBadge';

export default function Topbar({ onMenu, onSearch }) {
  const { user } = useAuth();

  return (
    <header className="bg-white/85 backdrop-blur-md border-b" style={{ borderColor: 'var(--gc-line)' }}>
      <div className="flex items-center justify-between gap-3 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="lg:hidden gc-btn gc-btn-outline gc-btn-sm"
            onClick={onMenu}
            aria-label="Open navigation"
          >
            ☰
          </button>
          <span className="gc-eyebrow">GovChain Operations</span>
          <BlockchainStatusBadge />
        </div>

        <div className="flex items-center gap-3">
          <button 
            type="button" 
            className="gc-btn gc-btn-outline gc-btn-sm gc-hover-lift gc-interactive bg-white shadow-sm flex items-center pr-1.5" 
            onClick={onSearch}
          >
            <span className="text-gray-400 font-normal mr-1">⌕</span>
            <span className="text-gray-600 font-medium">Search records...</span>
            <span className="gc-kbd font-mono tracking-tighter ml-3 border-gray-200">⌘K</span>
          </button>
          <div className="hidden md:block text-right">
            <p className="text-sm font-semibold leading-tight">{user.name}</p>
            <p className="text-xs text-gray-500 leading-tight capitalize">
              {user.role.replace('_', ' ')}
            </p>
          </div>
        </div>
      </div>
    </header>
  );
}