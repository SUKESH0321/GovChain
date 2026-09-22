const { Pool } = require('pg');

// PostgreSQL connection pool.
// The pool is lazy: it only connects when the first query is made,
// so the server can start even before the database is available.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

module.exports = pool;