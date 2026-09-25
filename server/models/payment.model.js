const pool = require('../config/db');

// GovChain — Stage 3.1 · payment requests.
//
// All payment SQL lives here, exactly like the project/tender/milestone models.
// A payment is created only from a VERIFIED milestone: the backend derives the
// project/tender/contractor relationship from the milestone row, so the client
// never chooses who a payment belongs to.

function mapPayment(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    project_id: row.project_id,
    project_name: row.project_name,
    tender_id: row.tender_id,
    tender_title: row.tender_title,
    milestone_id: row.milestone_id,
    milestone_title: row.milestone_title,
    milestone_status: row.milestone_status,
    contractor_id: row.contractor_id,
    contractor_name: row.contractor_name,
    amount: row.amount !== null ? Number(row.amount) : null,
    status: row.status,
    reason: row.reason,
    requested_by: row.requested_by,
    requested_by_name: row.requested_by_name,
    authorized_by: row.authorized_by,
    authorized_by_name: row.authorized_by_name,
    released_by: row.released_by,
    released_by_name: row.released_by_name,
    blockchain_tx_hash: row.blockchain_tx_hash,
    blockchain_block_number: row.blockchain_block_number,
    requested_at: row.requested_at,
    authorized_at: row.authorized_at,
    released_at: row.released_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// Base SELECT that joins the project, tender, milestone and user names.
const selectPayments =
  'SELECT pay.id, pay.project_id, p.name AS project_name, pay.tender_id, t.title AS tender_title, ' +
  'pay.milestone_id, m.title AS milestone_title, m.status AS milestone_status, ' +
  'pay.contractor_id, c.name AS contractor_name, pay.amount, pay.status, pay.reason, ' +
  'pay.requested_by, ru.name AS requested_by_name, ' +
  'pay.authorized_by, au.name AS authorized_by_name, ' +
  'pay.released_by, lu.name AS released_by_name, ' +
  'pay.blockchain_tx_hash, pay.blockchain_block_number, ' +
  'pay.requested_at, pay.authorized_at, pay.released_at, pay.created_at, pay.updated_at ' +
  'FROM payments pay ' +
  'LEFT JOIN projects p ON p.id = pay.project_id ' +
  'LEFT JOIN tenders t ON t.id = pay.tender_id ' +
  'LEFT JOIN milestones m ON m.id = pay.milestone_id ' +
  'LEFT JOIN users c ON c.id = pay.contractor_id ' +
  'LEFT JOIN users ru ON ru.id = pay.requested_by ' +
  'LEFT JOIN users au ON au.id = pay.authorized_by ' +
  'LEFT JOIN users lu ON lu.id = pay.released_by';

async function createPayment({ project_id, tender_id, milestone_id, contractor_id, amount, requested_by }) {
  const { rows } = await pool.query(
    `INSERT INTO payments
       (project_id, tender_id, milestone_id, contractor_id, amount, status, requested_by, requested_at)
     VALUES ($1, $2, $3, $4, $5, 'REQUESTED', $6, NOW())
     RETURNING id`,
    [project_id, tender_id, milestone_id, contractor_id, amount, requested_by]
  );
  return findById(rows[0].id);
}

// Optional filters — Stage 3.3 · status / project_id / milestone_id. Every filter
// is appended safely as a parameterised condition.
function buildFilters({ projectId = null, status = null, milestoneId = null } = {}) {
  const params = [];
  const conditions = [];

  if (projectId) {
    params.push(projectId);
    conditions.push(`pay.project_id = $${params.length}`);
  }
  if (status) {
    params.push(status);
    conditions.push(`pay.status = $${params.length}`);
  }
  if (milestoneId) {
    params.push(milestoneId);
    conditions.push(`pay.milestone_id = $${params.length}`);
  }

  return {
    where: conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '',
    params,
  };
}

// All payment records, optionally filtered. Auditors/officers see everything;
// the controller never passes a contractor id here.
async function findAll({ projectId = null, status = null, milestoneId = null } = {}) {
  const { where, params } = buildFilters({ projectId, status, milestoneId });
  const { rows } = await pool.query(
    `${selectPayments}${where} ORDER BY pay.requested_at DESC, pay.id DESC`,
    params
  );
  return rows.map(mapPayment);
}

// All payment records raised by one contractor, with the same optional filters.
async function findByContractor(contractorId, { projectId = null, status = null, milestoneId = null } = {}) {
  const { where, params } = buildFilters({ projectId, status, milestoneId });
  const clause = where ? `${where} AND pay.contractor_id = $${params.length + 1}` : ' WHERE pay.contractor_id = $1';
  params.push(contractorId);

  const { rows } = await pool.query(
    `${selectPayments}${clause} ORDER BY pay.requested_at DESC, pay.id DESC`,
    params
  );
  return rows.map(mapPayment);
}

async function findById(id) {
  const { rows } = await pool.query(`${selectPayments} WHERE pay.id = $1`, [id]);
  return mapPayment(rows[0]);
}

// Transitions: REQUESTED -> AUTHORIZED / REJECTED. The status check in the WHERE
// clause makes double-authorization / double-rejection races impossible.
async function updateStatus(id, status, { authorized_by = null, reason = null } = {}) {
  const isAuthorization = status === 'AUTHORIZED';
  const { rows } = await pool.query(
    `UPDATE payments
        SET status = $2,
            authorized_by = $3,
            authorized_at = CASE WHEN $2 = 'AUTHORIZED' THEN NOW() ELSE authorized_at END,
            reason = COALESCE($4, reason),
            updated_at = NOW()
      WHERE id = $1 AND status = 'REQUESTED'
      RETURNING id`,
    [id, status, authorized_by, reason]
  );
  if (!rows[0]) {
    return null;
  }
  return findById(rows[0].id);
}

// GovChain — Stage 3.2 · simulated payment release.
// Single allowed transition: AUTHORIZED -> RELEASED. The WHERE guard makes a
// second release (or a release of a REQUESTED/REJECTED payment) impossible at
// the database level, so no duplicate blockchain transaction can be triggered.
// The release amount is never changed — the stored authorized amount is reused.
async function releasePayment(id, releasedBy) {
  const { rows } = await pool.query(
    `UPDATE payments
        SET status = 'RELEASED',
            released_by = $2,
            released_at = NOW(),
            updated_at = NOW()
      WHERE id = $1 AND status = 'AUTHORIZED'
      RETURNING id`,
    [id, releasedBy]
  );
  if (!rows[0]) {
    return null;
  }
  return findById(rows[0].id);
}

// True when the given contractor is assigned to a tender on the project the
// milestone belongs to — reused from the milestone model's validation pattern.
async function milestoneBelongsToAssignedTender(milestoneId, contractorId) {
  const { rows } = await pool.query(
    `SELECT 1
       FROM milestones m
       INNER JOIN tenders t ON t.project_id = m.project_id AND t.contractor_id = $2
      WHERE m.id = $1`,
    [milestoneId, contractorId]
  );
  return rows.length > 0;
}

module.exports = {
  createPayment,
  findAll,
  findByContractor,
  findById,
  updateStatus,
  releasePayment,
  milestoneBelongsToAssignedTender,
};
