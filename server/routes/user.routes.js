const express = require('express');

const userController = require('../controllers/user.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/authorize');
const { ROLES } = require('../utils/roles');

const router = express.Router();

// Only Government Officers may list users (used for contractor assignment).
router.use(authenticate, requireRole(ROLES.GOVERNMENT_OFFICER));
router.get('/', userController.listUsersByRole);

module.exports = router;