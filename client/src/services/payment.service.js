import { request } from './api';

// GovChain — Stage 3.1 · payment request & authorization.

// POST /api/payments → { message, payment }
export async function requestPayment(milestoneId, amount) {
  return request('/payments', {
    method: 'POST',
    body: JSON.stringify({ milestone_id: milestoneId, amount }),
  });
}

// GET /api/payments → { payments }
// Stage 3.3 · optional filters: { status, project_id, milestone_id }.
export async function getPayments(filters = {}) {
  const params = new URLSearchParams();
  if (filters.status) {
    params.set('status', filters.status);
  }
  if (filters.project_id) {
    params.set('project_id', filters.project_id);
  }
  if (filters.milestone_id) {
    params.set('milestone_id', filters.milestone_id);
  }
  const query = params.toString();
  return request(`/payments${query ? `?${query}` : ''}`);
}

// PUT /api/payments/:id/authorize → { message, payment, blockchain }
export async function authorizePayment(id) {
  return request(`/payments/${id}/authorize`, { method: 'PUT' });
}

// PUT /api/payments/:id/reject → { message, payment }
export async function rejectPayment(id, reason) {
  return request(`/payments/${id}/reject`, {
    method: 'PUT',
    body: JSON.stringify({ reason: reason || '' }),
  });
}

// Stage 3.2 · simulated release. No body: the amount comes from the stored
// payment row. → { message, payment, blockchain }
export async function releasePayment(id) {
  return request(`/payments/${id}/release`, { method: 'PUT' });
}

// Stage 3.1/3.2 · GET /api/payments/:id/blockchain-history
// → { paymentId, projectId, history, meta } — PaymentAuthorized / PaymentReleased
// read from the GovChain contract event logs.
export async function getPaymentBlockchainHistory(id) {
  return request(`/payments/${id}/blockchain-history`);
}
