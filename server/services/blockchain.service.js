const { ethers } = require('ethers');

const blockchainConfig = require('../config/blockchain');
const blockchainModel = require('../models/blockchain.model');

// The deployed recordPaymentReleased(paymentId, projectId, amount, recipient)
// requires a recipient address. GovChain contractors do not have wallets (see
// the contract's own comments), so the on-chain recipient is the zero address —
// an explicit "no wallet" marker — and the real recipient identity (the
// off-chain GovChain contractor id) stays in the blockchain_events payload.
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

// ============================================================================
// GovChain — Stage 2.2 – 2.5 · blockchain service
//
// The single place in the backend that talks to the EVM chain:
//   1. connect()          - ethers.js provider + signing account + contract
//   2. record*()          - one blockchain transaction per GovChain app event
//   3. get*History()      - the opposite direction (Stage 2.4): reads the actual
//                           contract event logs back out of the chain as audit
//                           history (project / tender / milestone)
//   4. getStatus()        - safe (no-secret) view of the current configuration
//   5. getBlockchainStatus() - Stage 2.5 live probe: the RPC must answer and the
//                           contract's bytecode must be at the configured address
//                           (never exposes secrets, never throws)
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
//
// Reading history is the opposite: it throws (with an HTTP status attached) when
// the chain cannot be read, because a missing audit trail must never be reported
// as an empty one.
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
  // Stage 3.1 · the existing contract event carries paymentId/projectId/amount;
  // the milestone id stays off-chain (blockchain_events payload) because the
  // deployed PaymentAuthorized event has no milestone field.
  PaymentAuthorized: {
    fn: 'recordPaymentAuthorized',
    args: ({ entityId, projectId, amount }) => [
      toUint(entityId, 'paymentId'),
      toUint(projectId, 'projectId'),
      toUint(amount, 'amount'),
    ],
  },
  // Stage 3.2 · simulated payment release. The deployed contract function is
  // recordPaymentReleased(paymentId, projectId, amount, recipient); the recipient
  // is the zero address because contractors have no wallets (see ZERO_ADDRESS).
  PaymentReleased: {
    fn: 'recordPaymentReleased',
    args: ({ entityId, projectId, amount }) => [
      toUint(entityId, 'paymentId'),
      toUint(projectId, 'projectId'),
      toUint(amount, 'amount'),
      ZERO_ADDRESS,
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
    return {
      ...base,
      status: 'FAILED',
      txHash: null,
      blockNumber: null,
      error: message,
      errorKind: 'BLOCKCHAIN_ERROR',
    };
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

    return {
      ...base,
      status: 'FAILED',
      txHash: null,
      blockNumber: null,
      error: message,
      errorKind: 'BLOCKCHAIN_ERROR',
    };
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
      errorKind: 'BLOCKCHAIN_ERROR',
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

// ---------------------------------------------------------------------------
// Stage 3.1 · payment authorization ledger
//
// PUT /api/payments/:id/authorize — records PaymentAuthorized on-chain after the
// PostgreSQL status change succeeded. The milestone id is kept off-chain in the
// ledger payload: the deployed contract event only carries paymentId, projectId
// and amount. The payment row stores the transaction hash through the existing
// updateEntityReference mechanism (payments.blockchain_tx_hash).
// ---------------------------------------------------------------------------
async function recordPaymentAuthorized({
  paymentId,
  projectId,
  milestoneId,
  amount,
  actorUserId,
}) {
  return recordEvent({
    eventName: 'PaymentAuthorized',
    entityType: 'payment',
    entityId: paymentId,
    projectId,
    actorUserId,
    payload: {
      milestoneId,
      amount,
      authorizedAt: toTimestampKey(new Date()),
    },
    params: { entityId: paymentId, projectId, amount },
    idempotencyKey: `PaymentAuthorized:payment:${paymentId}`,
    updateEntityReference: true,
  });
}

// ---------------------------------------------------------------------------
// Stage 3.2 · payment release ledger (simulated)
//
// PUT /api/payments/:id/release — records PaymentReleased on-chain after the
// PostgreSQL status change (AUTHORIZED -> RELEASED) succeeded. No funds move:
// the release is simulated inside GovChain and the chain record is only the
// audit trail of that state transition. The amount comes from the stored
// payment row — the release endpoint cannot change it. The same architecture
// as recordPaymentAuthorized: never throws, failures land in blockchain_events
// with status 'FAILED' and the real transaction hash/block number are waited
// for and stored when the transaction succeeds.
// ---------------------------------------------------------------------------
async function recordPaymentReleased({
  paymentId,
  projectId,
  contractorId,
  amount,
  actorUserId,
}) {
  return recordEvent({
    eventName: 'PaymentReleased',
    entityType: 'payment',
    entityId: paymentId,
    projectId,
    actorUserId,
    payload: {
      contractorId,
      amount,
      recipientAddress: ZERO_ADDRESS,
      releasedAt: toTimestampKey(new Date()),
    },
    params: { entityId: paymentId, projectId, amount },
    idempotencyKey: `PaymentReleased:payment:${paymentId}`,
    updateEntityReference: true,
  });
}

// ============================================================================
// Stage 2.4 · blockchain history (the audit trail, read back from the chain)
//
// The recorders above write one event per GovChain action. This section reads
// those events back out of the chain with ethers.js and turns them into flat
// audit records, so the questions "what happened, who did it, when, in which
// transaction and which block" can be answered from the chain itself.
//
// The event name, identifiers, actor address, blockchain timestamp, transaction
// hash, block number and log position all come from the actual event log of the
// deployed GovChain contract - nothing is reconstructed from PostgreSQL, and no
// transaction hash or block number is ever invented. PostgreSQL is consulted
// afterwards only to attach the optional "which GovChain user triggered this"
// label (blockchain_events is keyed by transaction hash).
// ============================================================================

// How each GovChain event is read back. The argument names are exactly the
// Solidity parameter names, so the mapping cannot drift from the contract.
// `referenceArg` is the bounded short reference the recorders put on chain
// (projectReference / tenderReference / the milestone `title` slot that carries
// MST-<id> / the rejection `reason`); free-form text always stays off-chain.
const AUDIT_EVENTS = Object.freeze({
  ProjectCreated: {
    entityType: 'project',
    entityIdArg: 'projectId',
    projectIdArg: 'projectId',
    referenceArg: 'projectReference',
  },
  ProjectUpdated: {
    entityType: 'project',
    entityIdArg: 'projectId',
    projectIdArg: 'projectId',
    referenceArg: 'projectReference',
  },
  TenderCreated: {
    entityType: 'tender',
    entityIdArg: 'tenderId',
    projectIdArg: 'projectId',
    referenceArg: 'tenderReference',
  },
  TenderAssigned: {
    entityType: 'tender',
    entityIdArg: 'tenderId',
    projectIdArg: 'projectId',
    counterpartyArg: 'contractorId',
  },
  MilestoneCreated: {
    entityType: 'milestone',
    entityIdArg: 'milestoneId',
    projectIdArg: 'projectId',
    referenceArg: 'title',
  },
  MilestoneSubmitted: {
    entityType: 'milestone',
    entityIdArg: 'milestoneId',
    projectIdArg: 'projectId',
  },
  MilestoneVerified: {
    entityType: 'milestone',
    entityIdArg: 'milestoneId',
    projectIdArg: 'projectId',
  },
  MilestoneRejected: {
    entityType: 'milestone',
    entityIdArg: 'milestoneId',
    projectIdArg: 'projectId',
    referenceArg: 'reason',
  },
  // Stage 3.1/3.2 · the payment ledger events. Both carry (paymentId, projectId,
  // amount) on chain; the milestone id and the recipient identity stay off-chain.
  PaymentAuthorized: {
    entityType: 'payment',
    entityIdArg: 'paymentId',
    projectIdArg: 'projectId',
    amountArg: 'amount',
  },
  PaymentReleased: {
    entityType: 'payment',
    entityIdArg: 'paymentId',
    projectIdArg: 'projectId',
    amountArg: 'amount',
  },
});

// uint256 → plain number. Identifiers and unix timestamps are far below
// Number.MAX_SAFE_INTEGER, and anything that is not a safe integer is dropped
// instead of being silently rounded.
function toAuditNumber(value) {
  const big = typeof value === 'bigint' ? value : null;

  if (big === null) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const asNumber = Number(big);
  return Number.isSafeInteger(asNumber) ? asNumber : null;
}

// On-chain strings are bounded short references — kept as emitted.
function toAuditText(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

// Errors thrown here carry the HTTP status the controllers should answer with:
// 503 when the blockchain cannot be used at all (missing configuration / node
// unreachable) and 502 when the node rejected the log query. Their messages
// never contain the private key.
function auditUnavailableError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// The audit readers reuse the very same cached provider/contract as the
// recorders — no provider is created per request.
async function connectForAudit() {
  try {
    return await connect();
  } catch (error) {
    const message = sanitizeError(error);
    console.error(`[blockchain] audit history unavailable: ${message}`);
    throw auditUnavailableError(`Blockchain history is unavailable: ${message}`, 503);
  }
}

// Topic hashes of every event this service records, taken from the contract ABI
// itself (so the query cannot ask for an event the deployed contract does not
// declare).
function auditTopicHashes(contractInterface) {
  return Object.keys(AUDIT_EVENTS).map((eventName) => {
    const fragment = contractInterface.getEvent(eventName);
    if (!fragment) {
      throw new Error(`the GovChain ABI does not declare the ${eventName} event`);
    }
    return fragment.topicHash;
  });
}

// One event log → one audit record. Returns null for anything that is not a
// GovChain event this service records.
function buildAuditRecord(contractInterface, log) {
  let parsed;

  try {
    parsed = contractInterface.parseLog({ topics: log.topics, data: log.data });
  } catch (error) {
    console.warn(
      `[blockchain] could not read log ${log.transactionHash} (index ${log.index}): ${sanitizeError(
        error
      )}`
    );
    return null;
  }

  const definition = parsed ? AUDIT_EVENTS[parsed.name] : null;
  if (!definition) {
    return null;
  }

  const { args } = parsed;
  const entityId = toAuditNumber(args[definition.entityIdArg]);
  const projectId = toAuditNumber(args[definition.projectIdArg]);
  const timestamp = toAuditNumber(args.timestamp);

  return {
    event: parsed.name,
    entityType: definition.entityType,
    entityId,
    projectId,
    tenderId: definition.entityType === 'tender' ? entityId : null,
    milestoneId: definition.entityType === 'milestone' ? entityId : null,
    // Stage 3.1/3.2 · the on-chain amount of a payment event (null otherwise).
    amount: definition.amountArg ? toAuditNumber(args[definition.amountArg]) : null,
    contractorId: definition.counterpartyArg
      ? toAuditNumber(args[definition.counterpartyArg])
      : null,
    actor: toAuditText(args.actor),
    // block.timestamp, exactly as emitted by the contract (unix seconds).
    timestamp,
    timestampISO: timestamp === null ? null : new Date(timestamp * 1000).toISOString(),
    transactionHash: log.transactionHash,
    blockNumber: log.blockNumber,
    transactionIndex: log.transactionIndex,
    logIndex: log.index,
    contractAddress: log.address,
    reference: definition.referenceArg ? toAuditText(args[definition.referenceArg]) : null,
    // Filled in by attachOffChainActors() when the ledger knows the user.
    actorUser: null,
  };
}

// Deterministic blockchain order: block, then transaction inside the block,
// then log position inside the transaction.
function compareAuditRecords(a, b) {
  if (a.blockNumber !== b.blockNumber) {
    return a.blockNumber - b.blockNumber;
  }
  if (a.transactionIndex !== b.transactionIndex) {
    return a.transactionIndex - b.transactionIndex;
  }
  return a.logIndex - b.logIndex;
}

// Adds the GovChain user that triggered a transaction — purely a label for the
// audit view. A chain event with no ledger row keeps actorUser = null; the
// history itself is never taken from the database.
async function attachOffChainActors(records) {
  if (records.length === 0) {
    return records;
  }

  try {
    const txHashes = Array.from(new Set(records.map((record) => record.transactionHash)));
    const rows = await blockchainModel.findActorsByTxHashes(txHashes);
    const byTxHash = new Map(rows.map((row) => [row.tx_hash, row]));

    return records.map((record) => {
      const row = byTxHash.get(record.transactionHash);
      if (!row || !row.actor_user_id) {
        return record;
      }

      return {
        ...record,
        actorUser: {
          id: row.actor_user_id,
          name: row.actor_name || null,
          role: row.actor_role || null,
        },
      };
    });
  } catch (error) {
    // Losing the optional label never costs the history itself.
    logOnce(`audit history actor labels are unavailable: ${sanitizeError(error)}`);
    return records;
  }
}

// Reads every GovChain event in a single eth_getLogs call, starting at the block
// the contract was deployed in (config/blockchain.js) and running to the chain
// head. Filtering happens in memory because the identifier to filter on is not
// indexed in the same topic position for every event.
async function readAuditRecords() {
  const connection = await connectForAudit();
  const fromBlock = blockchainConfig.getAuditStartBlock();

  try {
    const [logs, toBlock] = await Promise.all([
      connection.provider.getLogs({
        address: connection.address,
        topics: [auditTopicHashes(connection.contract.interface)],
        fromBlock,
        toBlock: 'latest',
      }),
      connection.provider.getBlockNumber(),
    ]);

    const history = await attachOffChainActors(
      logs
        .map((log) => buildAuditRecord(connection.contract.interface, log))
        .filter((record) => record !== null)
        .sort(compareAuditRecords)
    );

    return {
      history,
      meta: {
        contractAddress: connection.address,
        chainId: connection.chainId,
        fromBlock,
        toBlock,
      },
    };
  } catch (error) {
    const message = sanitizeError(error);
    console.error(`[blockchain] audit history could not be read: ${message}`);
    throw auditUnavailableError(
      'Blockchain history could not be read from the local EVM node',
      502
    );
  }
}

// Generic audit reader. Every filter is optional; the records always come from
// the chain event logs, in blockchain order.
async function getAuditHistory({
  event = null,
  entityType = null,
  entityId = null,
  projectId = null,
} = {}) {
  const { history, meta } = await readAuditRecords();

  const wantedId = Number.isInteger(entityId) ? entityId : null;
  const wantedProjectId = Number.isInteger(projectId) ? projectId : null;

  const filtered = history.filter(
    (record) =>
      (!event || record.event === event) &&
      (!entityType || record.entityType === entityType) &&
      (wantedId === null || record.entityId === wantedId) &&
      (wantedProjectId === null || record.projectId === wantedProjectId)
  );

  return { history: filtered, meta: { ...meta, eventCount: filtered.length } };
}

// Every event that belongs to one project: the project itself plus the tenders
// and milestones recorded against it (both carry the project id on chain).
async function getProjectHistory(projectId) {
  return getAuditHistory({ projectId: Number(toUint(projectId, 'projectId')) });
}

// TenderCreated / TenderAssigned for one tender.
async function getTenderHistory(tenderId) {
  return getAuditHistory({
    entityType: 'tender',
    entityId: Number(toUint(tenderId, 'tenderId')),
  });
}

// MilestoneCreated / MilestoneSubmitted / MilestoneVerified / MilestoneRejected
// for one milestone.
async function getMilestoneHistory(milestoneId) {
  return getAuditHistory({
    entityType: 'milestone',
    entityId: Number(toUint(milestoneId, 'milestoneId')),
  });
}

// GovChain — Stage 3.1/3.2 · PaymentAuthorized / PaymentReleased for one payment.
async function getPaymentHistory(paymentId) {
  return getAuditHistory({
    entityType: 'payment',
    entityId: Number(toUint(paymentId, 'paymentId')),
  });
}

// GovChain — Stage 2.5 · live blockchain status.
//
// Unlike getStatus() (a configuration snapshot), this actually probes the local
// EVM node: the RPC must answer and the configured address must hold contract
// bytecode before `connected` / `contractReachable` are true. The method never
// throws — an unreachable chain is a valid status, not a server error — and it
// never exposes the private key or any other secret. Intentionally no caching
// and no automatic retry loop: every call is one cheap read-only probe.
async function getBlockchainStatus() {
  const summary = blockchainConfig.getBlockchainConfig();

  const status = {
    enabled: summary.enabled,
    configured: summary.configured,
    rpcUrl: summary.rpcUrl,
    contractAddress: summary.contractAddress,
    contractAddressSource: summary.contractAddressSource,
    connected: false,
    contractReachable: false,
    chainId: null,
    signer: null,
    latestBlock: null,
    checkedAt: new Date().toISOString(),
    reason: null,
  };

  if (!summary.enabled) {
    status.reason = 'blockchain recording is disabled (BLOCKCHAIN_ENABLED=false)';
    return status;
  }
  if (!summary.configured) {
    status.reason = `blockchain recording is not configured (missing: ${summary.missing.join(', ')})`;
    return status;
  }

  try {
    const active = await connect();

    const [blockNumber, contractCode] = await Promise.all([
      active.provider.getBlockNumber(),
      active.provider.getCode(active.address),
    ]);

    status.connected = true;
    status.chainId = active.chainId;
    status.signer = active.signerAddress;
    status.latestBlock = blockNumber;
    status.contractReachable =
      typeof contractCode === 'string' && contractCode !== '0x' && contractCode.length > 2;

    if (!status.contractReachable) {
      status.reason = 'no contract bytecode at the configured GOVCHAIN_CONTRACT_ADDRESS';
    }
  } catch (error) {
    // An unreachable node is reported honestly — never fabricated into success.
    status.reason = sanitizeError(error);
    console.error(`[blockchain] status check failed: ${status.reason}`);
  }

  return status;
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
  recordPaymentAuthorized,
  recordPaymentReleased,
  getAuditHistory,
  getProjectHistory,
  getTenderHistory,
  getMilestoneHistory,
  getPaymentHistory,
  getStatus,
  getBlockchainStatus,
  buildProjectReference,
  buildTenderReference,
  buildMilestoneReference,
};
