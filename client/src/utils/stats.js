import { getProjectMilestones } from '../services/milestone.service';
import { getProjects } from '../services/project.service';
import { getTenders } from '../services/tender.service';

// Loads every milestone across all projects (there is no global milestone
// endpoint, so we aggregate the existing per-project endpoint).
export async function loadAllMilestones() {
  const { projects } = await getProjects();
  const results = await Promise.all(
    projects.map((project) => getProjectMilestones(project.id))
  );
  return results.flatMap((data) => data.milestones);
}

// Loads projects, tenders and all milestones in one go for dashboard pages.
export async function loadOverview() {
  const [projectsData, tendersData, milestones] = await Promise.all([
    getProjects(),
    getTenders(),
    loadAllMilestones(),
  ]);
  return { projects: projectsData.projects, tenders: tendersData.tenders, milestones };
}

export function countActiveProjects(projects) {
  return projects.filter(
    (project) => project.status !== 'COMPLETED' && project.status !== 'CANCELLED'
  ).length;
}

export function getAssignedTenders(tenders, userId) {
  return tenders.filter((tender) => tender.contractor_id === userId);
}

export function getAssignedProjects(projects, assignedTenders) {
  const ids = new Set(assignedTenders.map((tender) => tender.project_id));
  return projects.filter((project) => ids.has(project.id));
}

export function filterMilestonesForProjects(milestones, projects) {
  const ids = new Set(projects.map((project) => project.id));
  return milestones.filter((milestone) => ids.has(milestone.project_id));
}