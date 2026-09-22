const healthService = require('../services/health.service');

async function getHealth(req, res) {
  try {
    const health = await healthService.getHealth();
    res.json(health);
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'Internal server error' });
  }
}

module.exports = { getHealth };