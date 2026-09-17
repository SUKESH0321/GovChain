const fs = require('fs');
const path = require('path');

// Always load server/.env from its real location, regardless of the folder the
// command runs from (e.g. npm run db:init, node server/db/init.js, or the server).
const envPath = path.join(__dirname, '..', '.env');
const env = require('dotenv').config({ path: envPath });

if (env.error || !process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set. Make sure server/.env exists and defines DATABASE_URL (and JWT_SECRET).');
}

const pool = require('../config/db');

// Applies db/schema.sql (the users table) to the PostgreSQL database configured
// in server/.env. Idempotent — the schema uses CREATE TABLE IF NOT EXISTS.
async function initDatabase() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await pool.query(schema);
  console.log('Database schema applied successfully.');
}

// CLI entry point — run with `npm run db:init`.
if (require.main === module) {
  initDatabase()
    .catch((error) => {
      console.error(`Failed to apply database schema: ${error.message}`);
      console.error('Check that DATABASE_URL points to a running PostgreSQL server and that the database exists.');
      process.exitCode = 1;
    })
    .finally(() => pool.end());
}

module.exports = { initDatabase };