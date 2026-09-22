const express = require('express');

const blockchainController = require('../controllers/blockchain.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// Blockchain status is read-only and open to every authenticated role
// (officers, contractors and auditors may all see whether the ledger is live).
// It does not bypass authentication and never exposes configuration secrets.
router.use(authenticate);

// Stage 2.5 · GET /api/blockchain/status
router.get('/status', blockchainController.getBlockchainStatus);

module.exports = router;