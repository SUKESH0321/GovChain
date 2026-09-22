const tenderModel = require('../models/tender.model');
const projectModel = require('../models/project.model');
const userModel = require('../models/user.model');
const blockchainService = require('../services/blockchain.service');
const { TENDER_STATUSES, isValidTenderStatus } = require('../utils/statuses');
const { ROLES } = require('../utils/roles');

// POST /api/tenders — Government Officer only.
async function createTender(req, res) {
  try {
    const projectId = Number(req.body.project_id);
    const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
    const description = typeof req.body.description === 'string' ? req.body.description.trim() : null;
    const tenderAmount = Number(req.body.tender_amount);
    const status = typeof req.body.status === 'string' && req.body.status ? req.body.status : 'OPEN';

    if (!Number.isInteger(projectId) || projectId <= 0) {
      return res.status(400).json({ message: 'project_id is required' });
    }
    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }
    if (!Number.isFinite(tenderAmount) || tenderAmount <= 0) {
      return res.status(400).json({ message: 'tender_amount must be a positive number' });
    }
    if (!isValidTenderStatus(status)) {
      return res.status(400).json({ message: `Status must be one of: ${TENDER_STATUSES.join(', ')}` });
    }

    const project = await projectModel.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const tender = await tenderModel.createTender({
      project_id: projectId,
      title,
      description,
      tender_amount: tenderAmount,
      created_by: req.user.id,
    });

    // Recorded on-chain only after the tender exists in PostgreSQL. Failures are
    // stored in blockchain_events (status 'FAILED') and returned in the response;
    // the tender itself is never rolled back because of the blockchain.
    const blockchain = await blockchainService.recordTenderCreated({
      tenderId: tender.id,
      projectId: tender.project_id,
      actorUserId: req.user.id,
    });

    return res.status(201).json({ message: 'Tender created successfully', tender, blockchain });
  } catch (error) {
    console.error(`[tenders/create] ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// GET /api/tenders — any authenticated user. Optional ?project_id= filter.
async function getAllTenders(req, res) {
  try {
    let projectId = null;
    if (req.query.project_id) {
      projectId = Number(req.query.project_id);
      if (!Number.isInteger(projectId) || projectId <= 0) {
        return res.status(400).json({ message: 'Invalid project_id' });
      }
    }

    const tenders = await tenderModel.findAll(projectId);
    return res.json({ tenders });
  } catch (error) {
    console.error(`[tenders/list] ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// GET /api/tenders/:id — any authenticated user.
async function getTenderById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid tender id' });
    }

    const tender = await tenderModel.findById(id);
    if (!tender) {
      return res.status(404).json({ message: 'Tender not found' });
    }

    return res.json({ tender });
  } catch (error) {
    console.error(`[tenders/get] ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// PUT /api/tenders/:id/assign — Government Officer only.
async function assignContractor(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid tender id' });
    }

    const contractorId = Number(req.body.contractor_id);
    if (!Number.isInteger(contractorId) || contractorId <= 0) {
      return res.status(400).json({ message: 'contractor_id is required' });
    }

    const tender = await tenderModel.findById(id);
    if (!tender) {
      return res.status(404).json({ message: 'Tender not found' });
    }

    const contractor = await userModel.findById(contractorId);
    if (!contractor) {
      return res.status(404).json({ message: 'Contractor not found' });
    }
    if (contractor.role !== ROLES.CONTRACTOR) {
      return res.status(400).json({ message: 'Selected user is not a Contractor' });
    }

    const updated = await tenderModel.assignContractor(id, contractorId);

    // Recorded on-chain only after the assignment is stored in PostgreSQL. Only
    // the off-chain contractor id is written on-chain — no personal details.
    const blockchain = await blockchainService.recordTenderAssigned({
      tenderId: updated.id,
      projectId: updated.project_id,
      contractorId,
      actorUserId: req.user.id,
    });

    return res.json({
      message: 'Contractor assigned successfully',
      tender: updated,
      blockchain,
    });
  } catch (error) {
    console.error(`[tenders/assign] ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { createTender, getAllTenders, getTenderById, assignContractor };