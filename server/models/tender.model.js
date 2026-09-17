const pool = require('../config/db');

function mapTender(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    project_id: row.project_id,
    project_name: row.project_name,
    title: row.title,
    description: row.description,
    tender_amount: row.tender_amount !== null ? Number(row.tender_amount) : null,
    contractor_id: row.contractor_id,
    contractor_name: row.contractor_name,
    status: row.status,
    created_by: row.created_by,
    created_by_name: row.created_by_name,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// Base SELECT that joins the project, the assigned contractor and the creator.
const selectTenders =
  'SELECT t.id, t.project_id, p.name AS project_name, t.title, t.description, ' +
  't.tender_amount, t.contractor_id, c.name AS contractor_name, t.status, ' +
  't.created_by, u.name AS created_by_name, t.created_at, t.updated_at ' +
  'FROM tenders t ' +
  'LEFT JOIN projects p ON p.id = t.project_id ' +
  'LEFT JOIN users c ON c.id = t.contractor_id ' +
  'LEFT JOIN users u ON u.id = t.created_by';

async function createTender({ project_id, title, description, tender_amount, created_by }) {
  const { rows } = await pool.query(
    `INSERT INTO tenders (project_id, title, description, tender_amount, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [project_id, title, description, tender_amount, created_by]
  );
  return findById(rows[0].id);
}

// projectId is optional — when provided, only that project's tenders are returned.
async function findAll(projectId = null) {
  const params = [];
  let where = '';
  if (projectId) {
    params.push(projectId);
    where = ' WHERE t.project_id = $1';
  }
  const { rows } = await pool.query(
    `${selectTenders}${where} ORDER BY t.created_at DESC, t.id DESC`,
    params
  );
  return rows.map(mapTender);
}

async function findById(id) {
  const { rows } = await pool.query(`${selectTenders} WHERE t.id = $1`, [id]);
  return mapTender(rows[0]);
}

// Assigns a contractor to the tender and moves its status to ASSIGNED.
async function assignContractor(id, contractorId) {
  const { rows } = await pool.query(
    `UPDATE tenders
     SET contractor_id = $2, status = 'ASSIGNED', updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [id, contractorId]
  );
  if (!rows[0]) {
    return null;
  }
  return findById(rows[0].id);
}

module.exports = { createTender, findAll, findById, assignContractor };