const express = require('express');

const milestoneController = require('../controllers/milestone.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticate);
router.put('/:id', milestoneController.updateMilestoneStatus);

module.exports = router;