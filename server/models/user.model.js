const pool = require('../config/db');

const SAFE_COLUMNS = 'id, name, email, role, created_at';

// Create a new user. Returns the stored user without the password hash.
async function createUser({ name, email, passwordHash, role }) {
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING ${SAFE_COLUMNS}`,
    [name, email, passwordHash, role]
  );
  return rows[0];
}

// Returns the full row, including password_hash — used internally by the auth
// controller to verify credentials during login. The hash never leaves the server.
async function findByEmail(email) {
  const { rows } = await pool.query(
    `SELECT id, name, email, password_hash, role, created_at
     FROM users
     WHERE email = $1`,
    [email]
  );
  return rows[0];
}

// Returns the stored user without the password hash.
async function findById(id) {
  const { rows } = await pool.query(
    `SELECT ${SAFE_COLUMNS}
     FROM users
     WHERE id = $1`,
    [id]
  );
  return rows[0];
}

// Returns all users with the given role (safe columns only).
async function findByRole(role) {
  const { rows } = await pool.query(
    `SELECT ${SAFE_COLUMNS}
     FROM users
     WHERE role = $1
     ORDER BY name`,
    [role]
  );
  return rows;
}

// Strip the password hash from a user row before sending it to the frontend.
function toSafeUser(row) {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    created_at: row.created_at,
  };
}

module.exports = { createUser, findByEmail, findById, findByRole, toSafeUser };