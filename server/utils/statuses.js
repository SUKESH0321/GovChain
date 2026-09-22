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
  'SUBMITTED',
  'VERIFIED',
  'REJECTED',
  'COMPLETED',
]);

// Statuses an operator may set directly (milestone creation and the generic
// PUT /api/milestones/:id update). SUBMITTED / VERIFIED / REJECTED are reached
// only through the dedicated Stage 2.3 lifecycle endpoints, so every review
// step is recorded on the blockchain with its own transaction.
const MILESTONE_MANUAL_STATUSES = Object.freeze(['PENDING', 'IN_PROGRESS', 'COMPLETED']);

function isValidProjectStatus(status) {
  return PROJECT_STATUSES.includes(status);
}

function isValidTenderStatus(status) {
  return TENDER_STATUSES.includes(status);
}

// Any milestone status, including the review states.
function isValidMilestoneStatus(status) {
  return MILESTONE_STATUSES.includes(status);
}

// Only the statuses that may be set by hand (create + generic update).
function isValidMilestoneManualStatus(status) {
  return MILESTONE_MANUAL_STATUSES.includes(status);
}

module.exports = {
  PROJECT_STATUSES,
  TENDER_STATUSES,
  MILESTONE_STATUSES,
  MILESTONE_MANUAL_STATUSES,
  isValidProjectStatus,
  isValidTenderStatus,
  isValidMilestoneStatus,
  isValidMilestoneManualStatus,
};