require('dotenv').config();

const express = require('express');
const cors = require('cors');

const routes = require('./routes');
const { initDatabase } = require('./db/init');

const app = express();
const PORT = process.env.PORT || 5000;

if (!process.env.JWT_SECRET) {
  console.warn('WARNING: JWT_SECRET is not set in server/.env — authentication will not work.');
}

// Global middleware
app.use(cors());
app.use(express.json());

// API routes (mounted under /api)
app.use('/api', routes);

// Simple error handler
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ message: 'Internal server error' });
});

// Apply the database schema (users table) on startup so registration works even
// if `npm run db:init` hasn't been run yet. Requires a reachable PostgreSQL.
// The schema uses CREATE TABLE IF NOT EXISTS, so this is safe to run every boot.
initDatabase().catch((error) => {
  console.error(`WARNING: could not apply the database schema on startup: ${error.message}`);
});

app.listen(PORT, () => {
  console.log(`GovChain server is running on http://localhost:${PORT}`);
});