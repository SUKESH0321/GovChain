const express = require('express');

const milestoneController = require('../controllers/milestone.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/authorize');
const { ROLES } = require('../utils/roles');

const router = express.Router();

router.use(authenticate);

// Stage 2.3 · milestone verification lifecycle. RBAC is enforced here exactly
// like the Stage 1 routes; the controller adds the contractor assignment check.
// Every endpoint records its event on the blockchain after PostgreSQL succeeds.
//   submit -> Government Officer, or the Contractor assigned to the project
//   verify -> Government Officer or Auditor
//   reject -> Government Officer or Auditor
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