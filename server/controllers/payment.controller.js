const paymentModel = require('../models/payment.model');
const milestoneModel = require('../models/milestone.model');
const blockchainService = require('../services/blockchain.service');
const pool = require('../config/db');
const { ROLES } = require('../utils/roles');

// GovChain — Stage 3.1/3.2 · payment requests, authorization and simulated release.
//
// PostgreSQL first, blockchain second — the same architecture as the tender and
// milestone flows. AUTHORIZED reaches the chain as PaymentAuthorized, and the
// simulated RELEASE reaches it as PaymentReleased; request/reject stay purely
// off-chain. The release is a simulation: no bank, gateway or wallet is involved.

// POST /api/payments — Contractor only.
// Body: { milestone_id, amount }. Everything else (project/tender/contractor) is
// derived server-side from the milestone, so the client cannot attach a payment
// to a foreign project or a different contractor.
async function createPayment(req, res) {
  try {
    if (req.user.role !== ROLES.CONTRACTOR) {
      return res.status(403).json({ message: 'Only contractors can request payments' });
    }

    const milestoneId = Number(req.body.milestone_id);
    if (!Number.isInteger(milestoneId) || milestoneId <= 0) {
      return res.status(400).json({ message: 'milestone_id must be a positive integer' });
    }

    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ message: 'amount must be a positive number' });
    }

    const milestone = await milestoneModel.findById(milestoneId);
    if (!milestone) {
      return res.status(404).json({ message: 'Milestone not found' });
    }

    if (milestone.status !== 'VERIFIED') {
      return res
        .status(400)
        .json({ message: 'Milestone must be verified before requesting payment' });
    }

    // The requesting contractor must be the one assigned to the project's tender.
    const assigned = await paymentModel.milestoneBelongsToAssignedTender(
      milestoneId,
      req.user.id
    );
    if (!assigned) {
      return res
        .status(403)
        .json({ message: 'Access denied: contractor is not assigned to this project' });
    }

    // Derive the tender from the milestone's project (the tender assigned to the
    // requesting contractor). project_id comes straight from the milestone row.
    const { rows: tenderRows } = await pool.query(
      `SELECT id FROM tenders WHERE project_id = $1 AND contractor_id = $2 LIMIT 1`,
      [milestone.project_id, req.user.id]
    );

    const tenderId = tenderRows.length > 0 ? tenderRows[0].id : null;

    const payment = await paymentModel.createPayment({
      project_id: milestone.project_id,
      tender_id: tenderId,
      milestone_id: milestone.id,
      contractor_id: req.user.id,
      amount,
      requested_by: req.user.id,
    });

    return res.status(201).json({ message: 'Payment requested', payment });
  } catch (error) {
    console.error(`[payments/create] ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// PUT /api/payments/:id/authorize — Government Officer only.
// REQUESTED -> AUTHORIZED. Records PaymentAuthorized on-chain afterwards.
async function authorizePayment(req, res) {
  try {
    const payment = await loadPayment(req, res);
    if (!payment) {
      return;
    }

    if (payment.status === 'AUTHORIZED') {
      return res.status(400).json({ message: 'Payment has already been authorized' });
    }
    if (payment.status !== 'REQUESTED') {
      return res.status(400).json({ message: 'Only a requested payment can be authorized' });
    }

    // PostgreSQL first — the transition is guarded in SQL (status = 'REQUESTED'),
    // so a concurrent authorize/reject cannot double-apply.
    const updated = await paymentModel.updateStatus(payment.id, 'AUTHORIZED', {
      authorized_by: req.user.id,
    });
    if (!updated) {
      return res.status(409).json({ message: 'Payment is no longer in REQUESTED state' });
    }

    // Blockchain second. The service never throws: a failed transaction is stored
    // in blockchain_events with status 'FAILED' and returned here, so the
    // authorization itself is never rolled back because of the chain.
    const blockchain = await blockchainService.recordPaymentAuthorized({
      paymentId: updated.id,
      projectId: updated.project_id,
      milestoneId: updated.milestone_id,
      amount: updated.amount,
      actorUserId: req.user.id,
    });

    return res.json({ message: 'Payment authorized', payment: updated, blockchain });
  } catch (error) {
    console.error(`[payments/authorize] ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// PUT /api/payments/:id/release — Government Officer only. AUTHORIZED -> RELEASED.
// Simulated release: no real funds move, no gateway is contacted. PostgreSQL
// first, blockchain second. The released amount is always the stored authorized
// amount — the request body is ignored, so a caller cannot change the amount.
async function releasePayment(req, res) {
  try {
    const payment = await loadPayment(req, res);
    if (!payment) {
      return;
    }

    if (payment.status === 'RELEASED') {
      return res.status(400).json({ message: 'Payment has already been released' });
    }
    if (payment.status !== 'AUTHORIZED') {
      return res.status(400).json({ message: 'Only an authorized payment can be released' });
    }

    // PostgreSQL first — the WHERE status = 'AUTHORIZED' guard in the model makes
    // a duplicate release (and therefore a duplicate blockchain transaction)
    // impossible, even under concurrent requests.
    const updated = await paymentModel.releasePayment(payment.id, req.user.id);
    if (!updated) {
      return res.status(409).json({ message: 'Payment is no longer in AUTHORIZED state' });
    }

    // Blockchain second. The service never throws: a failed transaction is stored
    // in blockchain_events with status 'FAILED' and returned here, so the release
    // itself is never rolled back because of the chain, and no transaction hash
    // is ever fabricated.
    const blockchain = await blockchainService.recordPaymentReleased({
      paymentId: updated.id,
      projectId: updated.project_id,
      contractorId: updated.contractor_id,
      amount: updated.amount,
      actorUserId: req.user.id,
    });

    return res.json({ message: 'Payment released (simulated)', payment: updated, blockchain });
  } catch (error) {
    console.error(`[payments/release] ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// PUT /api/payments/:id/reject — Government Officer only. REQUESTED -> REJECTED.
// Rejection stays off-chain (no blockchain event is defined for it in the
// contract); the optional reason is stored on the payment row.
async function rejectPayment(req, res) {
  try {
    const payment = await loadPayment(req, res);
    if (!payment) {
      return;
    }

    if (payment.status === 'AUTHORIZED') {
      return res.status(400).json({ message: 'An authorized payment cannot be rejected' });
    }
    if (payment.status !== 'REQUESTED') {
      return res.status(400).json({ message: 'Only a requested payment can be rejected' });
    }

    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0, 500) : null;

    const updated = await paymentModel.updateStatus(payment.id, 'REJECTED', {
      authorized_by: req.user.id,
      reason,
    });
    if (!updated) {
      return res.status(409).json({ message: 'Payment is no longer in REQUESTED state' });
    }

    return res.json({ message: 'Payment rejected', payment: updated });
  } catch (error) {
    console.error(`[payments/reject] ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// GET /api/payments — Officers and Auditors see all payments; Contractors only
// their own. Unrelated users' records are never exposed.
// Stage 3.3 · optional query filters: status / project_id / milestone_id
// (validated against the known statuses; everything is parameterised SQL).
const PAYMENT_STATUSES = ['REQUESTED', 'AUTHORIZED', 'RELEASED', 'REJECTED'];

async function getPayments(req, res) {
  try {
    const filters = {};

    if (req.query.project_id) {
      filters.projectId = Number(req.query.project_id);
      if (!Number.isInteger(filters.projectId) || filters.projectId <= 0) {
        return res.status(400).json({ message: 'Invalid project id' });
      }
    }

    if (req.query.milestone_id) {
      filters.milestoneId = Number(req.query.milestone_id);
      if (!Number.isInteger(filters.milestoneId) || filters.milestoneId <= 0) {
        return res.status(400).json({ message: 'Invalid milestone id' });
      }
    }

    if (req.query.status) {
      if (!PAYMENT_STATUSES.includes(req.query.status)) {
        return res
          .status(400)
          .json({ message: `status must be one of: ${PAYMENT_STATUSES.join(', ')}` });
      }
      filters.status = req.query.status;
    }

    if (req.user.role === ROLES.CONTRACTOR) {
      const payments = await paymentModel.findByContractor(req.user.id, filters);
      return res.json({ payments });
    }

    const payments = await paymentModel.findAll(filters);
    return res.json({ payments });
  } catch (error) {
    console.error(`[payments/list] ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// GET /api/payments/:id — same visibility rules as the list endpoint.
async function getPaymentById(req, res) {
  try {
    const payment = await loadPayment(req, res);
    if (!payment) {
      return;
    }
    return res.json({ payment });
  } catch (error) {
    console.error(`[payments/get] ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// GET /api/payments/:id/blockchain-history — any authenticated user.
//
// Stage 3.1/3.2 · the payment's on-chain audit history (PaymentAuthorized /
// PaymentReleased), read from the GovChain contract event logs — same pattern as
// the milestone history. Contractors are limited to their own payments by
// loadPayment's ownership check.
async function getPaymentBlockchainHistory(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ message: 'Invalid payment id' });
    }

    const payment = await loadPayment(req, res);
    if (!payment) {
      return;
    }

    const { history, meta } = await blockchainService.getPaymentHistory(id);

    return res.json({ paymentId: id, projectId: payment.project_id, history, meta });
  } catch (error) {
    console.error(`[payments/blockchain-history] ${error.message}`);

    // 503 = blockchain unavailable, 502 = chain could not be read; nothing is
    // ever replaced by an empty or fabricated history.
    if (error.statusCode === 503 || error.statusCode === 502) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// Shared guard: validates the id, loads the payment and applies the contractor
// ownership check. Sends the error response and returns null when not allowed.
async function loadPayment(req, res) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ message: 'Invalid payment id' });
    return null;
  }

  const payment = await paymentModel.findById(id);
  if (!payment) {
    res.status(404).json({ message: 'Payment request not found' });
    return null;
  }

  if (req.user.role === ROLES.CONTRACTOR && payment.contractor_id !== req.user.id) {
    res.status(403).json({ message: 'Access denied: this payment belongs to another contractor' });
    return null;
  }

  return payment;
}

module.exports = {
  createPayment,
  authorizePayment,
  releasePayment,
  rejectPayment,
  getPayments,
  getPaymentById,
  getPaymentBlockchainHistory,
};
