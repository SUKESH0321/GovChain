const milestoneModel = require('../models/milestone.model');
const projectModel = require('../models/project.model');
const blockchainService = require('../services/blockchain.service');
const {
  MILESTONE_MANUAL_STATUSES,
  isValidMilestoneManualStatus,
} = require('../utils/statuses');
const { ROLES } = require('../utils/roles');

// Stage 2.3 · the milestone lifecycle moves through the review states
// SUBMITTED -> VERIFIED / REJECTED. The generic status update endpoint keeps its
// Stage 1 behaviour (PENDING / IN_PROGRESS / COMPLETED) so the review states can
// only be reached through the dedicated endpoints below - each one records its
// own blockchain transaction.
const MILESTONE_REVIEW_BLOCKED = ['SUBMITTED', 'VERIFIED', 'COMPLETED'];

// Shared guard for the lifecycle endpoints: validates the milestone id, loads the
// milestone and applies the contractor assignment check. Sends the error
// response and returns null when the request is not allowed.
async function loadMilestoneForLifecycle(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ message: 'Invalid milestone id' });
    return null;
  }

  const milestone = await milestoneModel.findById(id);
  if (!milestone) {
    res.status(404).json({ message: 'Milestone not found' });
    return null;
  }

  if (req.user.role === ROLES.CONTRACTOR) {
    const assigned = await milestoneModel.belongsToAssignedTender(id, req.user.id);
    if (!assigned) {
      res.status(403).json({ message: 'Access denied: contractor is not assigned to this project' });
      return null;
    }
  }

  return milestone;
}

// POST /api/projects/:projectId/milestones — Government Officer only.
async function createMilestone(req, res) {
  try {
    const projectId = Number(req.params.projectId);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      return res.status(400).json({ message: 'Invalid project id' });
    }

    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : null;
    const amount = Number(req.body.amount);
    const status = typeof req.body.status === 'string' && req.body.status ? req.body.status : 'PENDING';

    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: 'amount must be a positive number' });
    }
    if (!isValidMilestoneManualStatus(status)) {
      return res.status(400).json({ message: `Status must be one of: ${MILESTONE_MANUAL_STATUSES.join(', ')}` });
    }

    let due_date = null;
    if (req.body.due_date) {
      due_date = new Date(req.body.due_date);
      if (Number.isNaN(due_date.getTime())) {
        return res.status(400).json({ message: 'due_date is not a valid date' });
      }
    }

    const project = await projectModel.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const milestone = await milestoneModel.createMilestone({ project_id: projectId, title, description, amount, due_date });

    // Recorded on-chain only after the milestone exists in PostgreSQL. The
    // service never throws: a failed transaction is stored in blockchain_events
    // with status 'FAILED' and returned here, so the milestone itself is never
    // rolled back because of the blockchain.
    const blockchain = await blockchainService.recordMilestoneCreated({
      milestoneId: milestone.id,
      projectId: milestone.project_id,
      actorUserId: req.user.id,
    });

    return res.status(201).json({ message: 'Milestone created successfully', milestone, blockchain });
  } catch (error) {
    console.error(`[milestones/create] ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// GET /api/projects/:projectId/milestones — any authenticated user.
async function getProjectMilestones(req, res) {
  try {
    const projectId = Number(req.params.projectId);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      return res.status(400).json({ message: 'Invalid project id' });
    }

    const project = await projectModel.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const milestones = await milestoneModel.findByProject(projectId);
    return res.json({ milestones });
  } catch (error) {
    console.error(`[milestones/list] ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// PUT /api/milestones/:id — Government Officer, or a Contractor assigned to a
// tender on the milestone's project. Auditors only view.
async function updateMilestoneStatus(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid milestone id' });
    }

    const status = typeof req.body.status === 'string' ? req.body.status : '';
    if (!status) {
      return res.status(400).json({ message: 'status is required' });
    }
    if (!isValidMilestoneManualStatus(status)) {
      return res.status(400).json({ message: `Status must be one of: ${MILESTONE_MANUAL_STATUSES.join(', ')}` });
    }

    const existing = await milestoneModel.findById(id);
    if (!existing) {
      return res.status(404).json({ message: 'Milestone not found' });
    }

    if (req.user.role === ROLES.GOVERNMENT_OFFICER) {
      // Officers can manage milestone status on any project.
    } else if (req.user.role === ROLES.CONTRACTOR) {
      const assigned = await milestoneModel.belongsToAssignedTender(id, req.user.id);
      if (!assigned) {
        return res.status(403).json({ message: 'Access denied: contractor is not assigned to this project' });
      }
    } else {
      return res.status(403).json({ message: 'Access denied: insufficient role' });
    }

    const milestone = await milestoneModel.updateStatus(id, status);
    return res.json({ message: 'Milestone status updated', milestone });
  } catch (error) {
    console.error(`[milestones/update] ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// PUT /api/milestones/:id/submit — Government Officer, or the Contractor assigned
// to a tender on the milestone's project. Emits MilestoneSubmitted.
async function submitMilestone(req, res) {
  try {
    const milestone = await loadMilestoneForLifecycle(req, res);
    if (!milestone) {
      return;
    }

    if (MILESTONE_REVIEW_BLOCKED.includes(milestone.status)) {
      return res.status(400).json({
        message: `A milestone with status ${milestone.status} cannot be submitted`,
      });
    }

    // PostgreSQL first, blockchain second — never the other way round.
    const updated = await milestoneModel.updateStatus(milestone.id, 'SUBMITTED');
    const blockchain = await blockchainService.recordMilestoneSubmitted({
      milestoneId: updated.id,
      projectId: updated.project_id,
      actorUserId: req.user.id,
      milestoneUpdatedAt: updated.updated_at,
    });

    return res.json({
      message: 'Milestone submitted for verification',
      milestone: updated,
      blockchain,
    });
  } catch (error) {
    console.error(`[milestones/submit] ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// PUT /api/milestones/:id/verify — Government Officer or Auditor.
// Emits MilestoneVerified.
async function verifyMilestone(req, res) {
  try {
    const milestone = await loadMilestoneForLifecycle(req, res);
    if (!milestone) {
      return;
    }

    if (milestone.status !== 'SUBMITTED') {
      return res.status(400).json({ message: 'Only a submitted milestone can be verified' });
    }

    const updated = await milestoneModel.updateStatus(milestone.id, 'VERIFIED');
    const blockchain = await blockchainService.recordMilestoneVerified({
      milestoneId: updated.id,
      projectId: updated.project_id,
      actorUserId: req.user.id,
      milestoneUpdatedAt: updated.updated_at,
    });

    return res.json({ message: 'Milestone verified', milestone: updated, blockchain });
  } catch (error) {
    console.error(`[milestones/verify] ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// PUT /api/milestones/:id/reject — Government Officer or Auditor.
// Emits MilestoneRejected. The optional reason stays off-chain (blockchain_events
// payload); only a bounded short reference is written to the contract.
async function rejectMilestone(req, res) {
  try {
    const milestone = await loadMilestoneForLifecycle(req, res);
    if (!milestone) {
      return;
    }

    if (milestone.status !== 'SUBMITTED') {
      return res.status(400).json({ message: 'Only a submitted milestone can be rejected' });
    }

    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0, 500) : '';

    const updated = await milestoneModel.updateStatus(milestone.id, 'REJECTED');
    const blockchain = await blockchainService.recordMilestoneRejected({
      milestoneId: updated.id,
      projectId: updated.project_id,
      actorUserId: req.user.id,
      milestoneUpdatedAt: updated.updated_at,
      reason,
    });

    return res.json({ message: 'Milestone rejected', milestone: updated, blockchain });
  } catch (error) {
    console.error(`[milestones/reject] ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = {
  createMilestone,
  getProjectMilestones,
  updateMilestoneStatus,
  submitMilestone,
  verifyMilestone,
  rejectMilestone,
};