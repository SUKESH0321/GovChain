const { ROLES } = require('../utils/roles');

// Creates middleware that lets the request through only when the authenticated
// user has one of the given roles. Use together with `authenticate`.
function requireRole(...allowedRoles) {
  return function (req, res, next) {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Access denied: insufficient role' });
    }
    next();
  };
}

// Convenience guards for each supported role.
const requireGovernmentOfficer = requireRole(ROLES.GOVERNMENT_OFFICER);
const requireContractor = requireRole(ROLES.CONTRACTOR);
const requireAuditor = requireRole(ROLES.AUDITOR);

module.exports = { requireRole, requireGovernmentOfficer, requireContractor, requireAuditor };