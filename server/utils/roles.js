const ROLES = Object.freeze({
  GOVERNMENT_OFFICER: 'government_officer',
  CONTRACTOR: 'contractor',
  AUDITOR: 'auditor',
});

const ALL_ROLES = Object.freeze(Object.values(ROLES));

function isValidRole(role) {
  return ALL_ROLES.includes(role);
}

module.exports = { ROLES, ALL_ROLES, isValidRole };