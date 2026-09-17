const PROJECT_STATUSES = Object.freeze([
  'PLANNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);

const TENDER_STATUSES = Object.freeze([
  'OPEN',
  'ASSIGNED',
  'CLOSED',
]);

const MILESTONE_STATUSES = Object.freeze([
  'PENDING',
  'IN_PROGRESS',
  'COMPLETED',
]);

function isValidProjectStatus(status) {
  return PROJECT_STATUSES.includes(status);
}

function isValidTenderStatus(status) {
  return TENDER_STATUSES.includes(status);
}

function isValidMilestoneStatus(status) {
  return MILESTONE_STATUSES.includes(status);
}

module.exports = {
  PROJECT_STATUSES,
  TENDER_STATUSES,
  MILESTONE_STATUSES,
  isValidProjectStatus,
  isValidTenderStatus,
  isValidMilestoneStatus,
};