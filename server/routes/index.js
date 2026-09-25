const express = require('express');

const authRoutes = require('./auth.routes');
const blockchainRoutes = require('./blockchain.routes');
const healthRoutes = require('./health.routes');
const milestoneRoutes = require('./milestone.routes');
const paymentRoutes = require('./payment.routes');
const projectRoutes = require('./project.routes');
const tenderRoutes = require('./tender.routes');
const userRoutes = require('./user.routes');

const router = express.Router();

router.use('/health', healthRoutes);
router.use('/blockchain', blockchainRoutes);
router.use('/auth', authRoutes);
router.use('/projects', projectRoutes);
router.use('/tenders', tenderRoutes);
router.use('/milestones', milestoneRoutes);
router.use('/payments', paymentRoutes);
router.use('/users', userRoutes);

// Stage 4.3 · read-only dashboard summary (see routes/risk.routes.js). Mounted
// here (GET /api/risk/summary) so it never collides with the per-project
// GET /api/projects/:projectId/risk-analysis endpoint.
const riskRoutes = require('./risk.routes');

router.use('/risk', riskRoutes);

module.exports = router;