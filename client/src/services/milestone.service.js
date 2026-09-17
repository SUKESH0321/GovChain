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

// PUT /api/milestones/:id → { message, milestone }
export async function updateMilestoneStatus(id, status) {
  return request(`/milestones/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
}