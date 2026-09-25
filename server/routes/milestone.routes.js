const express = require('express');

const milestoneController = require('../controllers/milestone.controller');
const riskController = require('../controllers/risk.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/authorize');
const { ROLES } = require('../utils/roles');

const router = express.Router();

router.use(authenticate);

// Stage 4.2 · milestone risk analysis. Read-only, calculated on request from the
// existing records: officers and auditors may analyse any milestone, a
// contractor only a milestone of a project whose tender is assigned to them
// (see risk.controller.js).
router.get('/:milestoneId/risk-analysis', riskController.getMilestoneRiskAnalysis);

// Stage 2.3 · milestone verification lifecycle. RBAC is enforced here exactly
// like the Stage 1 routes; the controller adds the contractor assignment check.
// Every endpoint records its event on the blockchain after PostgreSQL succeeds.
//   submit -> Government Officer, or the Contractor assigned to the project
//   verify -> Government Officer or Auditor
//   reject -> Government Officer or Auditor

// Stage 2.4 · blockchain audit history (MilestoneCreated / Submitted / Verified
// / Rejected), read straight from the GovChain event logs. Read-only, any
// authenticated role — auditors included.
router.get('/:id/blockchain-history', milestoneController.getMilestoneBlockchainHistory);
router.put(
  '/:id/submit',
  requireRole(ROLES.GOVERNMENT_OFFICER, ROLES.CONTRACTOR),
  milestoneController.submitMilestone
);
router.put(
  '/:id/verify',
  requireRole(ROLES.GOVERNMENT_OFFICER, ROLES.AUDITOR),
  milestoneController.verifyMilestone
);
router.put(
  '/:id/reject',
  requireRole(ROLES.GOVERNMENT_OFFICER, ROLES.AUDITOR),
  milestoneController.rejectMilestone
);

// Stage 1 status update — unchanged behaviour.
router.put('/:id', milestoneController.updateMilestoneStatus);

module.exports = router;