const projectModel = require('../models/project.model');
const { PROJECT_STATUSES, isValidProjectStatus } = require('../utils/statuses');

// Shared, simple server-side validation for create + update.
// Returns the validated fields, or sends a 400 response and returns null.
function parseProjectInput(req, res) {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const description = typeof req.body.description === 'string' ? req.body.description.trim() : null;
  const location = typeof req.body.location === 'string' ? req.body.location.trim() : null;
  const budget = Number(req.body.budget);
  const status = typeof req.body.status === 'string' && req.body.status ? req.body.status : 'PLANNED';

  if (!name) {
    res.status(400).json({ message: 'Name is required' });
    return null;
  }
  if (!Number.isFinite(budget) || budget <= 0) {
    res.status(400).json({ message: 'Budget must be a positive number' });
    return null;
  }
  if (!isValidProjectStatus(status)) {
    res.status(400).json({ message: `Status must be one of: ${PROJECT_STATUSES.join(', ')}` });
    return null;
  }

  let start_date = null;
  if (req.body.start_date) {
    start_date = new Date(req.body.start_date);
    if (Number.isNaN(start_date.getTime())) {
      res.status(400).json({ message: 'start_date is not a valid date' });
      return null;
    }
  }

  let end_date = null;
  if (req.body.end_date) {
    end_date = new Date(req.body.end_date);
    if (Number.isNaN(end_date.getTime())) {
      res.status(400).json({ message: 'end_date is not a valid date' });
      return null;
    }
  }

  if (start_date && end_date && end_date < start_date) {
    res.status(400).json({ message: 'end_date must be on or after start_date' });
    return null;
  }

  return { name, description, budget, location, start_date, end_date, status };
}

// POST /api/projects — Government Officer only.
async function createProject(req, res) {
  try {
    const input = parseProjectInput(req, res);
    if (!input) {
      return;
    }

    // created_by is always taken from the authenticated user, never from the body.
    const project = await projectModel.createProject({ ...input, created_by: req.user.id });

    return res.status(201).json({ message: 'Project created successfully', project });
  } catch (error) {
    console.error(`[projects/create] ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// GET /api/projects — any authenticated user.
async function getAllProjects(req, res) {
  try {
    const projects = await projectModel.findAll();
    return res.json({ projects });
  } catch (error) {
    console.error(`[projects/list] ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// GET /api/projects/:id — any authenticated user.
async function getProjectById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid project id' });
    }

    const project = await projectModel.findById(id);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    return res.json({ project });
  } catch (error) {
    console.error(`[projects/get] ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// PUT /api/projects/:id — Government Officer only.
async function updateProject(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid project id' });
    }

    const input = parseProjectInput(req, res);
    if (!input) {
      return;
    }

    const project = await projectModel.updateProject(id, input);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    return res.json({ message: 'Project updated successfully', project });
  } catch (error) {
    console.error(`[projects/update] ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { createProject, getAllProjects, getProjectById, updateProject };