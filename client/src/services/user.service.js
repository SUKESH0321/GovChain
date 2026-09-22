import { request } from './api';

// GET /api/users?role=contractor → { users }
// Government Officer only — used to populate the contractor picker when
// assigning a contractor to a tender.
export async function getContractors() {
  return request('/users?role=contractor');
}