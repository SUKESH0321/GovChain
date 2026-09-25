const express = require('express');

const paymentController = require('../controllers/payment.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { requireRole } = require('../middleware/authorize');
const { ROLES } = require('../utils/roles');

const router = express.Router();

router.use(authenticate);

// GovChain — Stage 3.1/3.2 · payment requests, authorization and simulated release.
//
// RBAC is enforced here exactly like the Stage 1/2.3 routes; the controller adds
// the milestone-status, payment-status and contractor-ownership checks.
//   POST /api/payments                -> Contractor (assigned to the project)
//   PUT  /api/payments/:id/authorize  -> Government Officer  (REQUESTED -> AUTHORIZED)
//   PUT  /api/payments/:id/release    -> Government Officer  (AUTHORIZED -> RELEASED, simulated)
//   PUT  /api/payments/:id/reject     -> Government Officer  (REQUESTED -> REJECTED)
//   GET  /api/payments[...]           -> any authenticated role (contractors are
//                                        filtered to their own payments)
router.get('/', paymentController.getPayments);
router.get('/:id', paymentController.getPaymentById);
router.get('/:id/blockchain-history', paymentController.getPaymentBlockchainHistory);
router.post('/', requireRole(ROLES.CONTRACTOR), paymentController.createPayment);
router.put('/:id/authorize', requireRole(ROLES.GOVERNMENT_OFFICER), paymentController.authorizePayment);
router.put('/:id/release', requireRole(ROLES.GOVERNMENT_OFFICER), paymentController.releasePayment);
router.put('/:id/reject', requireRole(ROLES.GOVERNMENT_OFFICER), paymentController.rejectPayment);

module.exports = router;
