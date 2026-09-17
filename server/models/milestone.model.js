const pool = require('../config/db');

// Convert a DATE row value to a simple YYYY-MM-DD string.
function toDateOnly(value) {
  if (!value) {
    return null;
  }
  const iso = value.toISOString ? value.toISOString() : String(value);
  return iso.slice(0, 10);
}

function mapMilestone(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    project_id: row.project_id,
    project_name: row.project_name,
    title: row.title,
    description: row.description,
    amount: row.amount !== null ? Number(row.amount) : null,
    due_date: toDateOnly(row.due_date),
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// Base SELECT that joins the milestone's project name.
const selectMilestones =
  'SELECT m.id, m.project_id, p.name AS project_name, m.title, m.description, ' +
  'm.amount, m.due_date, m.status, m.created_at, m.updated_at ' +
  'FROM milestones m LEFT JOIN projects p ON p.id = m.project_id';

async function createMilestone({ project_id, title, description, amount, due_date }) {
  const { rows } = await pool.query(
    `INSERT INTO milestones (project_id, title, description, amount, due_date)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [project_id, title, description, amount, due_date]
  );
  return findById(rows[0].id);
}

async function findByProject(projectId) {
  const { rows } = await pool.query(
    `${selectMilestones} WHERE m.project_id = $1 ORDER BY m.due_date NULLS LAST, m.id`,
    [projectId]
  );
  return rows.map(mapMilestone);
}

async function findById(id) {
  const { rows } = await pool.query(`${selectMilestones} WHERE m.id = $1`, [id]);
  return mapMilestone(rows[0]);
}

async function updateStatus(id, status) {
  const { rows } = await pool.query(
    `UPDATE milestones SET status = $2, updated_at = NOW() WHERE id = $1 RETURNING id`,
    [id, status]
  );
  if (!rows[0]) {
    return null;
  }
  return findById(rows[0].id);
}

// True when the given contractor is assigned to a tender on the project the
// milestone belongs to — used to let contractors update milestone status only
// on the projects they are working on.
async function belongsToAssignedTender(milestoneId, contractorId) {
  const { rows } = await pool.query(
    `SELECT 1
     FROM milestones m
     INNER JOIN tenders t ON t.project_id = m.project_id AND t.contractor_id = $2
     WHERE m.id = $1`,
    [milestoneId, contractorId]
  );
  return rows.length > 0;
}

module.exports = { createMilestone, findByProject, findById, updateStatus, belongsToAssignedTender };