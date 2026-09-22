const pool = require('../config/db');

// GovChain — Stage 2.2 · PostgreSQL side of the blockchain audit ledger.
//
// `blockchain_events` holds one row per application event that has to end up on
// chain. It is the source of truth for:
//   - idempotency  (idempotency_key is UNIQUE, so the same application event can
//     never produce two blockchain transactions)
//   - failure visibility / retry  (status = 'FAILED' plus error_message)
//   - the transaction hash of every recorded event (tx_hash, block_number)
//
// All SQL lives here. The blockchain service only orchestrates, so the Express
// controllers never see a query, and no ethers.js code ever touches PostgreSQL.

// Only these application tables carry a blockchain reference column
// (projects/tenders/milestones keep the hash of their creation transaction).
const ENTITY_TABLES = Object.freeze({
  project: 'projects',
  tender: 'tenders',
  milestone: 'milestones',
});

// Looks up a previously attempted event by its idempotency key.
async function findEventByIdempotencyKey(idempotencyKey) {
  const { rows } = await pool.query(
    `SELECT * FROM blockchain_events WHERE idempotency_key = $1`,
    [idempotencyKey]
  );
  return rows[0] || null;
}

// Inserts the event as PENDING unless it already exists (ON CONFLICT DO
// NOTHING), which makes concurrent/duplicate submissions safe. Returns the
// stored row plus whether this call inserted it.
async function createEventIfAbsent({
  idempotencyKey,
  eventName,
  entityType,
  entityId,
  projectId,
  actorUserId,
  payload,
}) {
  const { rows } = await pool.query(
    `INSERT INTO blockchain_events
       (idempotency_key, event_name, entity_type, entity_id, project_id, actor_user_id, payload, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'PENDING')
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING *`,
    [
      idempotencyKey,
      eventName,
      entityType,
      entityId,
      projectId,
      actorUserId,
      JSON.stringify(payload || {}),
    ]
  );

  if (rows[0]) {
    return { record: rows[0], created: true };
  }

  return { record: await findEventByIdempotencyKey(idempotencyKey), created: false };
}

// Marks the event as confirmed and stores the blockchain transaction details.
async function markConfirmed(id, { txHash, blockNumber }) {
  const { rows } = await pool.query(
    `UPDATE blockchain_events
        SET status = 'CONFIRMED',
            tx_hash = $2,
            block_number = $3,
            error_message = NULL,
            attempts = attempts + 1,
            confirmed_at = NOW(),
            updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [id, txHash, blockNumber]
  );
  return rows[0] || null;
}

// Marks the event as failed and keeps the reason so it can be retried later.
async function markFailed(id, { errorMessage }) {
  const { rows } = await pool.query(
    `UPDATE blockchain_events
        SET status = 'FAILED',
            error_message = $2,
            attempts = attempts + 1,
            updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [id, errorMessage]
  );
  return rows[0] || null;
}

// Stores the blockchain reference on the application row itself. Only used for
// the creation events, so `projects`/`tenders` keep the hash of their creation
// transaction and later events stay in blockchain_events.
async function setEntityBlockchainReference(entityType, entityId, { txHash, blockNumber }) {
  const table = ENTITY_TABLES[entityType];
  if (!table) {
    throw new Error(`unsupported blockchain entity type: ${entityType}`);
  }

  await pool.query(
    `UPDATE ${table}
        SET blockchain_tx_hash = $2, blockchain_block_number = $3
      WHERE id = $1`,
    [entityId, txHash, blockNumber]
  );
}

// Every blockchain event recorded for one application row (useful for a later
// explorer or reconciliation module).
async function findEventsForEntity(entityType, entityId) {
  const { rows } = await pool.query(
    `SELECT * FROM blockchain_events
      WHERE entity_type = $1 AND entity_id = $2
      ORDER BY created_at ASC, id ASC`,
    [entityType, entityId]
  );
  return rows;
}

// Events that never reached the chain (PENDING = interrupted, FAILED = error).
async function findEventsByStatus(status, limit = 50) {
  const { rows } = await pool.query(
    `SELECT * FROM blockchain_events
      WHERE status = $1
      ORDER BY created_at ASC, id ASC
      LIMIT $2`,
    [status, limit]
  );
  return rows;
}

// ---------------------------------------------------------------------------
// GovChain — Stage 2.4 · optional off-chain label for the audit history
//
// The audit history itself is read from the blockchain event logs (see
// services/blockchain.service.js). This lookup only answers the follow-up
// question "which GovChain user triggered that transaction?" by matching the
// transaction hash the chain reported against the ledger row the backend wrote
// when the event was recorded. Nothing is invented: a transaction that has no
// ledger row simply comes back without a label.
// ---------------------------------------------------------------------------
async function findActorsByTxHashes(txHashes) {
  if (!Array.isArray(txHashes) || txHashes.length === 0) {
    return [];
  }

  const { rows } = await pool.query(
    `SELECT be.tx_hash, be.event_name, be.entity_type, be.entity_id,
            be.actor_user_id, u.name AS actor_name, u.role AS actor_role
       FROM blockchain_events be
       LEFT JOIN users u ON u.id = be.actor_user_id
      WHERE be.tx_hash = ANY($1::text[])`,
    [txHashes]
  );
  return rows;
}

module.exports = {
  findEventByIdempotencyKey,
  createEventIfAbsent,
  markConfirmed,
  markFailed,
  setEntityBlockchainReference,
  findEventsForEntity,
  findEventsByStatus,
  findActorsByTxHashes,
};
