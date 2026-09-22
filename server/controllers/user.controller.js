const userModel = require('../models/user.model');
const { ALL_ROLES, isValidRole } = require('../utils/roles');

// GET /api/users?role=<role> — Government Officer only.
// Used to populate the contractor picker when assigning a contractor to a tender.
async function listUsersByRole(req, res) {
  try {
    const role = typeof req.query.role === 'string' ? req.query.role : '';

    if (!role) {
      return res.status(400).json({ message: 'role query parameter is required' });
    }
    if (!isValidRole(role)) {
      return res.status(400).json({ message: `Role must be one of: ${ALL_ROLES.join(', ')}` });
    }

    const users = await userModel.findByRole(role);
    return res.json({ users });
  } catch (error) {
    console.error(`[users/list] ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { listUsersByRole };