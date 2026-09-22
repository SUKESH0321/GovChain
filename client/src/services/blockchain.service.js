import { request } from './api';

// Stage 2.5 · GET /api/blockchain/status
// → { enabled, configured, connected, contractReachable, chainId, signer,
//     latestBlock, contractAddress, rpcUrl, checkedAt, reason }
// Read-only live probe of the local EVM node; never contains any secret.
export async function getBlockchainStatus() {
  return request('/blockchain/status');
}