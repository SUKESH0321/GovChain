const milestoneModel = require('../models/milestone.model');
const projectModel = require('../models/project.model');
const { MILESTONE_STATUSES, isValidMilestoneStatus } = require('../utils/statuses');
const { ROLES } = require('../utils/roles');

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
    if (!isValidMilestoneStatus(status)) {
      return res.status(400).json({ message: `Status must be one of: ${MILESTONE_STATUSES.join(', ')}` });
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
    return res.status(201).json({ message: 'Milestone created successfully', milestone });
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
    if (!isValidMilestoneStatus(status)) {
      return res.status(400).json({ message: `Status must be one of: ${MILESTONE_STATUSES.join(', ')}` });
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

module.exports = { createMilestone, getProjectMilestones, updateMilestoneStatus };