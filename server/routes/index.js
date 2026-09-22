const express = require('express');

const authRoutes = require('./auth.routes');
const healthRoutes = require('./health.routes');
const milestoneRoutes = require('./milestone.routes');
const projectRoutes = require('./project.routes');
const tenderRoutes = require('./tender.routes');
const userRoutes = require('./user.routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/projects', projectRoutes);
router.use('/tenders', tenderRoutes);
router.use('/milestones', milestoneRoutes);
router.use('/users', userRoutes);

module.exports = router;