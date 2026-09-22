import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import ErrorState from '../components/ui/ErrorState';
import { getHealth } from '../services/api';
import { getBlockchainStatus } from '../services/blockchain.service';

export default function Health() {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState(null);
  const [chain, setChain] = useState(null);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch((err) => setError(err.message));

    // Stage 2.5 · the blockchain probe is best-effort: if it fails (for example
    // without a session), the page simply shows the backend health only.
    getBlockchainStatus()
      .then(setChain)
      .catch(() => setChain(null));
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'transparent' }}>
      <div className="w-full max-w-lg gc-panel">
        <div style={{ height: 4, background: 'var(--gc-navy)' }} />
        <div className="p-8">
          <p className="gc-eyebrow">System diagnostics</p>
          <h1 className="text-xl mt-2 mb-4">Backend health</h1>

          {error ? (
            <ErrorState message={error} />
          ) : health ? (
            <pre className="bg-slate-50 border rounded p-3 text-xs overflow-x-auto font-mono">
              {JSON.stringify(health, null, 2)}
            </pre>
          ) : (
            <p className="text-gray-500">Loading…</p>
          )}

          {chain && (
            <>
              <h2 className="text-sm font-semibold mt-6 mb-2">Blockchain status</h2>
              <pre className="bg-slate-50 border rounded p-3 text-xs overflow-x-auto font-mono">
                {JSON.stringify(chain, null, 2)}
              </pre>
            </>
          )}

          <Link to="/" className="gc-link inline-block mt-4">← Back home</Link>
        </div>
      </div>
    </div>
  );
}