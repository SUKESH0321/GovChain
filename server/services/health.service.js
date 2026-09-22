const pool = require('../config/db');

async function checkDatabase() {
  try {
    await pool.query('SELECT 1');
    return 'connected';
  } catch (error) {
    return 'unavailable';
  }
}

async function getHealth() {
  const database = await checkDatabase();

  return {
    status: 'ok',
    message: 'GovChain backend is running',
    database,
    timestamp: new Date().toISOString(),
  };
}

module.exports = { getHealth };