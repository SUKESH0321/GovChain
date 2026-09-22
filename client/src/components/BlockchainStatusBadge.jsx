import { useEffect, useState } from 'react';

import { getToken } from '../services/api';
import { getBlockchainStatus } from '../services/blockchain.service';

// GovChain — Stage 2.5 · small blockchain connection indicator:
//   Blockchain ● Connected  /  Blockchain ● Unavailable
//
// Purely informational — the application never depends on this state, and every
// PostgreSQL feature keeps working when the local chain is down. It only polls
// while a JWT is present, because /api/blockchain/status is authenticated, so
// public pages render nothing instead of a misleading "Unavailable". No polling
// loop and no retry: a single probe on mount.
export default function BlockchainStatusBadge() {
  const [status, setStatus] = useState(null);
  const [hasToken, setHasToken] = useState(Boolean(getToken()));

  useEffect(() => {
    setHasToken(Boolean(getToken()));

    if (!getToken()) {
      return undefined;
    }

    let cancelled = false;

    getBlockchainStatus()
      .then((data) => {
        if (!cancelled) {
          setStatus(data);
        }
      })
      .catch(() => {
        // Network/auth failure — report honestly as unavailable.
        if (!cancelled) {
          setStatus({ connected: false, contractReachable: false, reason: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!hasToken) {
    return null;
  }

  if (!status) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
        <span className="text-gray-400">Blockchain…</span>
      </span>
    );
  }

  const connected = Boolean(status.connected && status.contractReachable);
  const label = connected ? 'Connected' : 'Unavailable';
  const dotClass = connected ? 'bg-emerald-500' : 'bg-red-400';
  const textClass = connected ? 'text-gray-600' : 'text-red-500';
  const title = connected
    ? `Blockchain connected — chain ${status.chainId ?? '?'}, latest block ${status.latestBlock ?? '?'}`
    : `Blockchain unavailable${status.reason ? `: ${status.reason}` : ''}`;

  return (
    <span className="inline-flex items-center gap-1.5 text-xs" title={title}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />
      <span className="text-gray-500">Blockchain</span>
      <span className={`font-medium ${textClass}`}>{label}</span>
    </span>
  );
}