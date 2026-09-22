const pool = require('../config/db');

// Convert a DATE row value to a simple YYYY-MM-DD string.
function toDateOnly(value) {
  if (!value) {
    return null;
  }
  const iso = value.toISOString ? value.toISOString() : String(value);
  return iso.slice(0, 10);
}

// Convert a row into a clean JSON-ready object (budget as a number, clean dates).
function mapProject(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    budget: row.budget !== null ? Number(row.budget) : null,
    location: row.location,
    start_date: toDateOnly(row.start_date),
    end_date: toDateOnly(row.end_date),
    status: row.status,
    created_by: row.created_by,
    created_by_name: row.created_by_name,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// Base SELECT that joins the creator's name from the users table.
const selectProjects =
  'SELECT p.id, p.name, p.description, p.budget, p.location, ' +
  'p.start_date, p.end_date, p.status, p.created_by, p.created_at, p.updated_at, ' +
  'u.name AS created_by_name ' +
  'FROM projects p LEFT JOIN users u ON u.id = p.created_by';

async function createProject({ name, description, budget, location, start_date, end_date, status, created_by }) {
  const { rows } = await pool.query(
    `INSERT INTO projects (name, description, budget, location, start_date, end_date, status, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`,
    [name, description, budget, location, start_date, end_date, status, created_by]
  );
  return findById(rows[0].id);
}

async function findAll() {
  const { rows } = await pool.query(`${selectProjects} ORDER BY p.created_at DESC, p.id DESC`);
  return rows.map(mapProject);
}

async function findById(id) {
  const { rows } = await pool.query(`${selectProjects} WHERE p.id = $1`, [id]);
  return mapProject(rows[0]);
}

async function updateProject(id, { name, description, budget, location, start_date, end_date, status }) {
  const { rows } = await pool.query(
    `UPDATE projects
     SET name = $2, description = $3, budget = $4, location = $5,
         start_date = $6, end_date = $7, status = $8, updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [id, name, description, budget, location, start_date, end_date, status]
  );
  if (!rows[0]) {
    return null;
  }
  return findById(rows[0].id);
}

module.exports = { createProject, findAll, findById, updateProject };