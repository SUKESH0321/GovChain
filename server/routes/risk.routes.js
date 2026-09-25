const express = require('express');

const riskController = require('../controllers/risk.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);

// Stage 4.3 · risk dashboard summary. Read-only, calculated on request from the
// existing GovChain records: one request returns every visible project with its
// risk level, score and signals, so the dashboard never needs one request per
// project. Contractors only see projects they are assigned to (see
// risk.controller.js); officers and auditors see every project.
router.get('/summary', riskController.getRiskSummary);

module.exports = router;
