const express = require('express');

const milestoneController = require('../controllers/milestone.controller');
const projectController = require('../controllers/project.controller');
const riskController = require('../controllers/risk.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/authorize');
const { ROLES } = require('../utils/roles');

const router = express.Router();

// All project routes require a valid JWT.
router.use(authenticate);

router.get('/', projectController.getAllProjects);
router.get('/:id', projectController.getProjectById);
router.post('/', requireRole(ROLES.GOVERNMENT_OFFICER), projectController.createProject);
router.put('/:id', requireRole(ROLES.GOVERNMENT_OFFICER), projectController.updateProject);

// Project-scoped milestones
router.get('/:projectId/milestones', milestoneController.getProjectMilestones);
router.post('/:projectId/milestones', requireRole(ROLES.GOVERNMENT_OFFICER), milestoneController.createMilestone);

// Stage 2.4 · blockchain audit history. Read-only and open to every
// authenticated role (officers, contractors and auditors may all inspect the
// on-chain history of a project they can already see).
router.get('/:id/blockchain-history', projectController.getProjectBlockchainHistory);

// Stage 4.1 · AI risk & anomaly analysis. Read-only, calculated on request from
// the existing GovChain records: officers and auditors may analyse any project,
// a contractor only a project they are assigned to (see risk.controller.js).
router.get('/:projectId/risk-analysis', riskController.getProjectRiskAnalysis);

module.exports = router;