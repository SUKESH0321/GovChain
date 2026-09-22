const express = require('express');

const tenderController = require('../controllers/tender.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/authorize');
const { ROLES } = require('../utils/roles');

const router = express.Router();

router.use(authenticate);

router.get('/', tenderController.getAllTenders);
router.get('/:id', tenderController.getTenderById);
router.post('/', requireRole(ROLES.GOVERNMENT_OFFICER), tenderController.createTender);
router.put('/:id/assign', requireRole(ROLES.GOVERNMENT_OFFICER), tenderController.assignContractor);

// Stage 2.4 · blockchain audit history (TenderCreated / TenderAssigned), read
// straight from the GovChain event logs. Read-only, any authenticated role.
router.get('/:id/blockchain-history', tenderController.getTenderBlockchainHistory);

module.exports = router;