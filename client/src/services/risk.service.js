import { request } from './api';

// Stage 4.1 · GET /api/projects/:id/risk-analysis
// → { riskAnalysis } — the deterministic, explainable risk indicators of a
// project, calculated by the backend from the existing GovChain records. No
// external AI service is involved and nothing is stored.
export async function getProjectRiskAnalysis(id) {
  return request(`/projects/${id}/risk-analysis`);
}

// Stage 4.2 · GET /api/milestones/:id/risk-analysis
// → { milestoneAnalysis } — the same engine focused on one milestone: its payment
// figures, its timeline and the signals that describe this milestone or its own
// payments. Read-only, calculated on request, nothing stored.
export async function getMilestoneRiskAnalysis(id) {
  return request(`/milestones/${id}/risk-analysis`);
}

// Stage 4.3 · GET /api/risk/summary
// → { summary, projects, disclaimer } — one request for the whole risk
// dashboard: every visible project with its risk level, score and signals,
// analysed by the same backend engine as the per-project endpoint.
export async function getRiskSummary() {
  return request('/risk/summary');
}
