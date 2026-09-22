import { request } from './api';

// GET /api/projects → { projects }
export async function getProjects() {
  return request('/projects');
}

// GET /api/projects/:id → { project }
export async function getProjectById(id) {
  return request(`/projects/${id}`);
}

// POST /api/projects → { message, project }
export async function createProject(payload) {
  return request('/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// PUT /api/projects/:id → { message, project }
export async function updateProject(id, payload) {
  return request(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

// Stage 2.4 · GET /api/projects/:id/blockchain-history
// → { projectId, history, meta } — the project's on-chain audit trail, read from
// the GovChain contract event logs by the backend.
export async function getProjectBlockchainHistory(id) {
  return request(`/projects/${id}/blockchain-history`);
}