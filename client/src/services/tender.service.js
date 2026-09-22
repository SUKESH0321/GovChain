import { request } from './api';

// GET /api/tenders (optionally filtered by project_id) → { tenders }
export async function getTenders(projectId) {
  const query = projectId ? `?project_id=${projectId}` : '';
  return request(`/tenders${query}`);
}

// GET /api/tenders/:id → { tender }
export async function getTenderById(id) {
  return request(`/tenders/${id}`);
}

// POST /api/tenders → { message, tender }
export async function createTender(payload) {
  return request('/tenders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// PUT /api/tenders/:id/assign → { message, tender }
export async function assignContractor(id, contractorId) {
  return request(`/tenders/${id}/assign`, {
    method: 'PUT',
    body: JSON.stringify({ contractor_id: contractorId }),
  });
}

// Stage 2.4 · GET /api/tenders/:id/blockchain-history
// → { tenderId, history, meta } — TenderCreated / TenderAssigned as recorded by
// the GovChain contract.
export async function getTenderBlockchainHistory(id) {
  return request(`/tenders/${id}/blockchain-history`);
}