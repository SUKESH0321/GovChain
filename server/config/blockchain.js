const fs = require('fs');
const path = require('path');

// GovChain — Stage 2.2 · blockchain configuration.
//
// Everything the Express backend needs in order to talk to the local EVM chain:
//   - the RPC endpoint of the local Hardhat node (server/.env)
//   - the signing account used as the on-chain actor (server/.env)
//   - the deployed GovChain contract address (server/.env, with the Stage 2.1
//     deployment artifact as a fallback so no address is ever hardcoded)
//   - the contract ABI, read directly from the Hardhat artifact produced by
//     `npm run compile` inside blockchain/ (the ABI is never duplicated by hand)
//
// No secret is ever returned by this module's summary helpers.

const SERVER_DIR = path.join(__dirname, '..');
const BLOCKCHAIN_DIR = path.join(SERVER_DIR, '..', 'blockchain');

const DEFAULT_ARTIFACT_PATH = path.join(
  BLOCKCHAIN_DIR,
  'artifacts',
  'contracts',
  'GovChain.sol',
  'GovChain.json'
);
const DEFAULT_DEPLOYMENT_PATH = path.join(BLOCKCHAIN_DIR, 'deployments', 'localhost.json');

// "true"/"1"/"yes"/"on" → true; anything else → the provided fallback.
function parseBoolean(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

// Configured paths may be absolute or relative to server/ (where the backend runs).
function resolvePath(value, fallback) {
  const target = value || fallback;
  return path.isAbsolute(target) ? target : path.resolve(SERVER_DIR, target);
}

const config = {
  enabled: parseBoolean(process.env.BLOCKCHAIN_ENABLED, true),
  rpcUrl: process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545',
  privateKey: process.env.BLOCKCHAIN_PRIVATE_KEY || '',
  contractAddress: process.env.GOVCHAIN_CONTRACT_ADDRESS || '',
  artifactPath: resolvePath(process.env.GOVCHAIN_ARTIFACT_PATH, DEFAULT_ARTIFACT_PATH),
  deploymentPath: resolvePath(process.env.GOVCHAIN_DEPLOYMENT_FILE, DEFAULT_DEPLOYMENT_PATH),
};

// The ABI is read once from the Hardhat artifact and cached for the process.
let cachedAbi = null;
let abiError = null;

function loadAbi() {
  if (cachedAbi) {
    return cachedAbi;
  }

  try {
    const artifact = JSON.parse(fs.readFileSync(config.artifactPath, 'utf8'));
    if (!Array.isArray(artifact.abi)) {
      throw new Error('the Hardhat artifact does not contain an "abi" array');
    }
    cachedAbi = artifact.abi;
    abiError = null;
    return cachedAbi;
  } catch (error) {
    abiError = error.message;
    return null;
  }
}

// The address comes from GOVCHAIN_CONTRACT_ADDRESS. When that is empty (for
// example right after `npm run deploy` but before server/.env is updated) the
// Stage 2.1 deployment artifact is used instead.
function resolveContractAddress() {
  if (config.contractAddress) {
    return { address: config.contractAddress, source: 'GOVCHAIN_CONTRACT_ADDRESS' };
  }

  try {
    const deployment = JSON.parse(fs.readFileSync(config.deploymentPath, 'utf8'));
    if (deployment && typeof deployment.address === 'string' && deployment.address) {
      return { address: deployment.address, source: config.deploymentPath };
    }
  } catch (error) {
    // No deployment artifact (or unreadable JSON) — reported through the summary.
  }

  return { address: null, source: null };
}

// Safe-to-log summary: never contains the private key.
function getBlockchainConfig() {
  const { address, source } = resolveContractAddress();
  const abi = loadAbi();

  const missing = [];
  if (!config.enabled) {
    missing.push('BLOCKCHAIN_ENABLED=false');
  }
  if (!config.privateKey) {
    missing.push('BLOCKCHAIN_PRIVATE_KEY');
  }
  if (!address) {
    missing.push('GOVCHAIN_CONTRACT_ADDRESS');
  }
  if (!abi) {
    missing.push(`contract ABI (${config.artifactPath})`);
  }

  return {
    enabled: config.enabled,
    configured: missing.length === 0,
    rpcUrl: config.rpcUrl,
    contractAddress: address,
    contractAddressSource: source,
    abiPath: config.artifactPath,
    abiAvailable: Boolean(abi),
    abiError,
    deploymentPath: config.deploymentPath,
    missing,
  };
}

module.exports = { getBlockchainConfig, loadAbi, resolveContractAddress, config };
