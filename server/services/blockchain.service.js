const { ethers } = require('ethers');

const blockchainConfig = require('../config/blockchain');
const blockchainModel = require('../models/blockchain.model');

// ============================================================================
// GovChain — Stage 2.2 / 2.3 · blockchain service
//
// The single place in the backend that talks to the EVM chain:
//   1. connect()   - ethers.js provider + signing account + GovChain contract
//   2. record*()   - one blockchain transaction per GovChain application event
//   3. getStatus() - safe (no-secret) view of the current configuration
//
// Covered events: project create/update, tender create/assign (Stage 2.2) and
// the milestone lifecycle create/submit/verify/reject (Stage 2.3).
//
// Address, ABI and key all come from configuration (server/.env / the Stage 2.1
// Hardhat outputs); nothing is hardcoded here.
//
// Two responsibilities are deliberately kept apart:
//   - the ethers.js work lives in this file (connect + submitEvent + wait)
//   - all SQL lives in models/blockchain.model.js (the audit ledger)
//
// Recording always runs AFTER the PostgreSQL operation succeeded, and it never
// throws into the caller: every function resolves to a plain result object
// ({ status, eventName, txHash, blockNumber }) so application data is never
// rolled back because of the blockchain. Failures are stored with status
// 'FAILED' in blockchain_events so a later module can retry/reconcile them.
// ============================================================================

// ---------------------------------------------------------------------------
// Event → GovChain.sol recorder mapping (identifiers are off-chain PG ids)
// ---------------------------------------------------------------------------
const EVENT_RECORDERS = Object.freeze({
  ProjectCreated: {
    fn: 'recordProjectCreated',
    args: ({ entityId }) => [toUint(entityId, 'projectId'), buildProjectReference(entityId)],
  },
  ProjectUpdated: {
    fn: 'recordProjectUpdated',
    args: ({ entityId }) => [toUint(entityId, 'projectId'), buildProjectReference(entityId)],
  },
  TenderCreated: {
    fn: 'recordTenderCreated',
    args: ({ entityId, projectId }) => [
      toUint(entityId, 'tenderId'),
      toUint(projectId, 'projectId'),
      buildTenderReference(entityId),
    ],
  },
  TenderAssigned: {
    fn: 'recordTenderAssigned',
    args: ({ entityId, projectId, contractorId }) => [
      toUint(entityId, 'tenderId'),
      toUint(projectId, 'projectId'),
      toUint(contractorId, 'contractorId'),
    ],
  },
  MilestoneCreated: {
    fn: 'recordMilestoneCreated',
    args: ({ entityId, projectId }) => [
      toUint(entityId, 'milestoneId'),
      toUint(projectId, 'projectId'),
      buildMilestoneReference(entityId),
    ],
  },
  MilestoneSubmitted: {
    fn: 'recordMilestoneSubmitted',
    args: ({ entityId, projectId }) => [
      toUint(entityId, 'milestoneId'),
      toUint(projectId, 'projectId'),
    ],
  },
  MilestoneVerified: {
    fn: 'recordMilestoneVerified',
    args: ({ entityId, projectId }) => [
      toUint(entityId, 'milestoneId'),
      toUint(projectId, 'projectId'),
    ],
  },
  MilestoneRejected: {
    fn: 'recordMilestoneRejected',
    args: ({ entityId, projectId, reasonReference }) => [
      toUint(entityId, 'milestoneId'),
      toUint(projectId, 'projectId'),
      buildReasonReference(reasonReference),
    ],
  },
});

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

// Solidity uint256 identifiers are passed as BigInt values.
function toUint(value, label) {
  let big;
  try {
    big = BigInt(value);
  } catch (error) {
    throw new Error(`invalid ${label}: ${value}`);
  }
  if (big <= 0n) {
    throw new Error(`invalid ${label}: ${value}`);
  }
  return big;
}

// Stable, non-sensitive references derived from the PostgreSQL id. Project
// names/descriptions and contractor details stay off-chain.
function buildProjectReference(projectId) {
  return `PRJ-${projectId}`;
}

function buildTenderReference(tenderId) {
  return `TND-${tenderId}`;
}

function buildMilestoneReference(milestoneId) {
  return `MST-${milestoneId}`;
}

// The on-chain rejection reason is a bounded short reference, never the full
// free-form text: the complete reason stays off-chain in blockchain_events.
const MAX_REASON_REFERENCE_LENGTH = 120;

function buildReasonReference(reason) {
  const text = typeof reason === 'string' ? reason.replace(/\s+/g, ' ').trim() : '';
  if (!text) {
    return 'REJECTED';
  }
  return text.slice(0, MAX_REASON_REFERENCE_LENGTH);
}

// Timestamps are only ever used inside the idempotency key.
function toTimestampKey(value) {
  if (!value) {
    return String(Date.now());
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(Date.now()) : date.toISOString();
}

// Keeps error messages short and free of anything key-shaped.
function sanitizeError(error) {
  const message = error && error.message ? error.message : String(error);
  return message.replace(/0x[0-9a-fA-F]{64}/g, '0x<redacted>').slice(0, 500);
}

let lastNotice = null;

// Configuration problems are reported once per distinct reason, not per request.
function logOnce(message) {
  if (lastNotice === message) {
    return;
  }
  lastNotice = message;
  console.warn(`[blockchain] ${message}`);
}

// ---------------------------------------------------------------------------
// ethers.js layer
// ---------------------------------------------------------------------------

let connection = null;

// Serialises submissions so two concurrent requests cannot race on the same
// nonce (each transaction is awaited before the next one is built).
let submissionQueue = Promise.resolve();

// Connects to the configured EVM RPC endpoint and loads the deployed GovChain
// contract. The connection is cached until the RPC URL or the address changes.
async function connect() {
  const summary = blockchainConfig.getBlockchainConfig();

  if (!summary.enabled) {
    throw new Error('blockchain recording is disabled (BLOCKCHAIN_ENABLED=false)');
  }
  if (!summary.contractAddress) {
    throw new Error(
      'no GovChain contract address: set GOVCHAIN_CONTRACT_ADDRESS in server/.env ' +
        'or deploy with "npm run deploy" inside blockchain/'
    );
  }
  if (!summary.abiAvailable) {
    throw new Error(
      `the GovChain ABI is unavailable at ${summary.abiPath} - run "npm run compile" inside blockchain/`
    );
  }
  if (!blockchainConfig.config.privateKey) {
    throw new Error('BLOCKCHAIN_PRIVATE_KEY is not set in server/.env');
  }

  if (
    connection &&
    connection.rpcUrl === summary.rpcUrl &&
    connection.address === summary.contractAddress
  ) {
    return connection;
  }

  const provider = new ethers.JsonRpcProvider(summary.rpcUrl);

  let wallet;
  try {
    wallet = new ethers.Wallet(blockchainConfig.config.privateKey, provider);
  } catch (error) {
    // ethers.js never echoes the key back, so this stays safe to log.
    throw new Error('BLOCKCHAIN_PRIVATE_KEY is not a valid private key');
  }

  const contract = new ethers.Contract(summary.contractAddress, blockchainConfig.loadAbi(), wallet);
  const { chainId } = await provider.getNetwork();
  const signerAddress = await wallet.getAddress();

  connection = {
    provider,
    wallet,
    contract,
    rpcUrl: summary.rpcUrl,
    address: summary.contractAddress,
    addressSource: summary.contractAddressSource,
    chainId: Number(chainId),
    signerAddress,
  };

  console.log(
    `[blockchain] connected: ${summary.rpcUrl} (chain ${connection.chainId}) ` +
      `contract ${connection.address} signer ${signerAddress}`
  );

  return connection;
}

// Submits one recorder transaction and waits for the first confirmation.
// Resolves to { transactionHash, blockNumber }.
async function submitEvent(eventName, params) {
  const recorder = EVENT_RECORDERS[eventName];
  if (!recorder) {
    throw new Error(`unknown blockchain event: ${eventName}`);
  }

  const { contract } = await connect();
  const transaction = await contract[recorder.fn](...recorder.args(params));

  console.log(`[blockchain] ${eventName} submitted: ${transaction.hash}`);

  const receipt = await transaction.wait(1);
  const blockNumber =
    receipt && receipt.blockNumber !== null && receipt.blockNumber !== undefined
      ? receipt.blockNumber
      : null;

  console.log(`[blockchain] ${eventName} confirmed: ${transaction.hash} (block ${blockNumber})`);

  return { transactionHash: transaction.hash, blockNumber };
}

// ---------------------------------------------------------------------------
// Ledger orchestration
// ---------------------------------------------------------------------------

// If the event already reached a final state, this returns the result the caller
// should receive instead of submitting a duplicate transaction.
function settledResult(base, record, idempotencyKey) {
  if (!record) {
    return null;
  }

  if (record.status === 'CONFIRMED') {
    console.log(`[blockchain] ${base.eventName} already recorded: ${record.tx_hash}`);
    return {
      ...base,
      status: 'ALREADY_RECORDED',
      txHash: record.tx_hash,
      blockNumber: record.block_number,
    };
  }

  if (record.status === 'PENDING') {
    console.log(`[blockchain] ${base.eventName} already pending (${idempotencyKey})`);
    return {
      ...base,
      status: 'PENDING',
      txHash: null,
      blockNumber: null,
      reason: 'a previous submission for this event did not complete',
    };
  }

  // FAILED → fall through so the same row is retried.
  return null;
}

// Stores the event in PostgreSQL and, when it is not recorded yet, submits it to
// the chain and updates both the ledger row and the application row.
async function recordEventInternal({
  eventName,
  entityType,
  entityId,
  projectId = null,
  actorUserId = null,
  payload = {},
  params = {},
  idempotencyKey,
  updateEntityReference = false,
}) {
  const base = { eventName, entityType, entityId };

  const summary = blockchainConfig.getBlockchainConfig();
  if (!summary.enabled || !summary.configured) {
    const reason = summary.enabled
      ? `blockchain recording is not configured (missing: ${summary.missing.join(', ')})`
      : 'blockchain recording is disabled (BLOCKCHAIN_ENABLED=false)';
    logOnce(reason);
    return { ...base, status: 'DISABLED', txHash: null, blockNumber: null, reason };
  }

  let record;

  try {
    const settled = settledResult(
      base,
      await blockchainModel.findEventByIdempotencyKey(idempotencyKey),
      idempotencyKey
    );
    if (settled) {
      return settled;
    }

    const inserted = await blockchainModel.createEventIfAbsent({
      idempotencyKey,
      eventName,
      entityType,
      entityId,
      projectId,
      actorUserId,
      payload,
    });

    record = inserted.record;

    if (!record) {
      throw new Error('the blockchain event could not be stored in PostgreSQL');
    }

    if (!inserted.created) {
      // Another request inserted the same event first.
      const raced = settledResult(base, record, idempotencyKey);
      if (raced) {
        return raced;
      }
    }
  } catch (error) {
    const message = sanitizeError(error);
    console.error(`[blockchain] ${eventName} could not be queued: ${message}`);
    return { ...base, status: 'FAILED', txHash: null, blockNumber: null, error: message };
  }

  try {
    // The queue is kept alive across failures (`.catch(() => undefined)`), so a
    // failed submission never blocks the events submitted after it.
    const submission = submissionQueue
      .catch(() => undefined)
      .then(() => submitEvent(eventName, params));
    submissionQueue = submission;

    const { transactionHash, blockNumber } = await submission;

    await blockchainModel.markConfirmed(record.id, { txHash: transactionHash, blockNumber });

    if (updateEntityReference) {
      await blockchainModel.setEntityBlockchainReference(entityType, entityId, {
        txHash: transactionHash,
        blockNumber,
      });
    }

    return { ...base, status: 'CONFIRMED', txHash: transactionHash, blockNumber };
  } catch (error) {
    // The PostgreSQL operation already succeeded - it is never rolled back here.
    const message = sanitizeError(error);
    console.error(`[blockchain] ${eventName} FAILED: ${message}`);

    try {
      await blockchainModel.markFailed(record.id, { errorMessage: message });
    } catch (ledgerError) {
      console.error(
        `[blockchain] could not store the failure for ${eventName}: ${sanitizeError(ledgerError)}`
      );
    }

    return { ...base, status: 'FAILED', txHash: null, blockNumber: null, error: message };
  }
}

// Public entry point. The internal function already handles every expected
// failure; this guard makes it impossible for a blockchain problem to turn a
// successful PostgreSQL operation into a 500 response.
async function recordEvent(options) {
  try {
    return await recordEventInternal(options);
  } catch (error) {
    const message = sanitizeError(error);
    console.error(`[blockchain] ${options.eventName} could not be recorded: ${message}`);
    return {
      eventName: options.eventName,
      entityType: options.entityType,
      entityId: options.entityId,
      status: 'FAILED',
      txHash: null,
      blockNumber: null,
      error: message,
    };
  }
}

// ---------------------------------------------------------------------------
// Public API used by the controllers
// ---------------------------------------------------------------------------

// POST /api/projects
async function recordProjectCreated({ projectId, actorUserId }) {
  return recordEvent({
    eventName: 'ProjectCreated',
    entityType: 'project',
    entityId: projectId,
    projectId,
    actorUserId,
    payload: { projectReference: buildProjectReference(projectId) },
    params: { entityId: projectId, projectId },
    idempotencyKey: `ProjectCreated:project:${projectId}`,
    updateEntityReference: true,
  });
}

// PUT /api/projects/:id — one record per successful update, keyed by updated_at.
async function recordProjectUpdated({ projectId, actorUserId, projectUpdatedAt }) {
  const updatedAt = toTimestampKey(projectUpdatedAt);

  return recordEvent({
    eventName: 'ProjectUpdated',
    entityType: 'project',
    entityId: projectId,
    projectId,
    actorUserId,
    payload: { projectReference: buildProjectReference(projectId), updatedAt },
    params: { entityId: projectId, projectId },
    idempotencyKey: `ProjectUpdated:project:${projectId}:${updatedAt}`,
    updateEntityReference: false,
  });
}

// POST /api/tenders
async function recordTenderCreated({ tenderId, projectId, actorUserId }) {
  return recordEvent({
    eventName: 'TenderCreated',
    entityType: 'tender',
    entityId: tenderId,
    projectId,
    actorUserId,
    payload: { tenderReference: buildTenderReference(tenderId) },
    params: { entityId: tenderId, projectId },
    idempotencyKey: `TenderCreated:tender:${tenderId}`,
    updateEntityReference: true,
  });
}

// PUT /api/tenders/:id/assign — only the off-chain contractor id goes on-chain.
async function recordTenderAssigned({ tenderId, projectId, contractorId, actorUserId }) {
  return recordEvent({
    eventName: 'TenderAssigned',
    entityType: 'tender',
    entityId: tenderId,
    projectId,
    actorUserId,
    payload: { contractorId },
    params: { entityId: tenderId, projectId, contractorId },
    idempotencyKey: `TenderAssigned:tender:${tenderId}:contractor:${contractorId}`,
    updateEntityReference: false,
  });
}

// ---------------------------------------------------------------------------
// Stage 2.3 · milestone verification ledger
//
// POST /api/projects/:projectId/milestones
async function recordMilestoneCreated({ milestoneId, projectId, actorUserId }) {
  return recordEvent({
    eventName: 'MilestoneCreated',
    entityType: 'milestone',
    entityId: milestoneId,
    projectId,
    actorUserId,
    payload: { milestoneReference: buildMilestoneReference(milestoneId) },
    params: { entityId: milestoneId, projectId },
    idempotencyKey: `MilestoneCreated:milestone:${milestoneId}`,
    updateEntityReference: true,
  });
}

// PUT /api/milestones/:id/submit — a milestone can be submitted again after a
// rejection, so each submission is keyed by the milestone's updated_at exactly
// like ProjectUpdated.
async function recordMilestoneSubmitted({ milestoneId, projectId, actorUserId, milestoneUpdatedAt }) {
  const updatedAt = toTimestampKey(milestoneUpdatedAt);

  return recordEvent({
    eventName: 'MilestoneSubmitted',
    entityType: 'milestone',
    entityId: milestoneId,
    projectId,
    actorUserId,
    payload: { milestoneReference: buildMilestoneReference(milestoneId), submittedAt: updatedAt },
    params: { entityId: milestoneId, projectId },
    idempotencyKey: `MilestoneSubmitted:milestone:${milestoneId}:${updatedAt}`,
    updateEntityReference: false,
  });
}

// PUT /api/milestones/:id/verify
async function recordMilestoneVerified({ milestoneId, projectId, actorUserId, milestoneUpdatedAt }) {
  const updatedAt = toTimestampKey(milestoneUpdatedAt);

  return recordEvent({
    eventName: 'MilestoneVerified',
    entityType: 'milestone',
    entityId: milestoneId,
    projectId,
    actorUserId,
    payload: { milestoneReference: buildMilestoneReference(milestoneId), verifiedAt: updatedAt },
    params: { entityId: milestoneId, projectId },
    idempotencyKey: `MilestoneVerified:milestone:${milestoneId}:${updatedAt}`,
    updateEntityReference: false,
  });
}

// PUT /api/milestones/:id/reject — `reason` stays off-chain in the ledger
// payload; only a bounded short reference reaches the contract.
async function recordMilestoneRejected({
  milestoneId,
  projectId,
  actorUserId,
  milestoneUpdatedAt,
  reason,
}) {
  const updatedAt = toTimestampKey(milestoneUpdatedAt);
  const reasonReference = buildReasonReference(reason);

  return recordEvent({
    eventName: 'MilestoneRejected',
    entityType: 'milestone',
    entityId: milestoneId,
    projectId,
    actorUserId,
    payload: {
      milestoneReference: buildMilestoneReference(milestoneId),
      rejectedAt: updatedAt,
      reasonReference,
      reason: typeof reason === 'string' ? reason.trim() : '',
    },
    params: { entityId: milestoneId, projectId, reasonReference },
    idempotencyKey: `MilestoneRejected:milestone:${milestoneId}:${updatedAt}`,
    updateEntityReference: false,
  });
}

// Safe status view (never exposes the private key).
async function getStatus() {
  const summary = blockchainConfig.getBlockchainConfig();

  return {
    enabled: summary.enabled,
    configured: summary.configured,
    rpcUrl: summary.rpcUrl,
    contractAddress: summary.contractAddress,
    contractAddressSource: summary.contractAddressSource,
    abiPath: summary.abiPath,
    missing: summary.missing,
    connected: Boolean(connection),
    chainId: connection ? connection.chainId : null,
    signer: connection ? connection.signerAddress : null,
  };
}

module.exports = {
  connect,
  submitEvent,
  recordProjectCreated,
  recordProjectUpdated,
  recordTenderCreated,
  recordTenderAssigned,
  recordMilestoneCreated,
  recordMilestoneSubmitted,
  recordMilestoneVerified,
  recordMilestoneRejected,
  getStatus,
  buildProjectReference,
  buildTenderReference,
  buildMilestoneReference,
};
