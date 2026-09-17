const express = require('express');

const milestoneController = require('../controllers/milestone.controller');
const projectController = require('../controllers/project.controller');
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

module.exports = router;