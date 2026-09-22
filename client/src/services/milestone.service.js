import { request } from './api';

// GET /api/projects/:projectId/milestones → { milestones }
export async function getProjectMilestones(projectId) {
  return request(`/projects/${projectId}/milestones`);
}

// POST /api/projects/:projectId/milestones → { message, milestone }
export async function createMilestone(projectId, payload) {
  return request(`/projects/${projectId}/milestones`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// PUT /api/milestones/:id → { message, milestone, blockchain }
export async function updateMilestoneStatus(id, status) {
  return request(`/milestones/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}

// Stage 2.3 · milestone lifecycle. Each call asks the backend to update the
// milestone and record the matching blockchain event.
// PUT /api/milestones/:id/submit → { message, milestone, blockchain }
export async function submitMilestone(id) {
  return request(`/milestones/${id}/submit`, { method: 'PUT' });
}

// PUT /api/milestones/:id/verify → { message, milestone, blockchain }
export async function verifyMilestone(id) {
  return request(`/milestones/${id}/verify`, { method: 'PUT' });
}

// PUT /api/milestones/:id/reject → { message, milestone, blockchain }
export async function rejectMilestone(id, reason) {
  return request(`/milestones/${id}/reject`, {
    method: 'PUT',
    body: JSON.stringify({ reason: reason || '' }),
  });
}