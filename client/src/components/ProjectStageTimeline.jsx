import { Fragment } from 'react';

export const PROJECT_STAGES = [
  { key: 'planning', label: 'Planning' },
  { key: 'tender', label: 'Tender' },
  { key: 'contract', label: 'Contract' },
  { key: 'execution', label: 'Execution' },
  { key: 'completion', label: 'Completion' },
];

// Derives the current lifecycle stage from the project's status and its tenders.
// Planning → Tender → Contract → Execution → Completion
export function resolveProjectStage(project, tenders = []) {
  if (project.status === 'COMPLETED') return 'completion';
  if (project.status === 'IN_PROGRESS') return 'execution';
  const projectTenders = tenders.filter((t) => t.project_id === project.id);
  const hasAssigned = projectTenders.some(
    (t) => t.status === 'ASSIGNED' || t.status === 'CLOSED'
  );
  if (hasAssigned) return 'contract';
  if (projectTenders.length > 0) return 'tender';
  return 'planning';
}

// Visual stepper that shows the current project stage from real data.
export default function ProjectStageTimeline({ project, tenders = [] }) {
  const current = resolveProjectStage(project, tenders);
  const currentIndex = PROJECT_STAGES.findIndex((s) => s.key === current);
  const cancelled = project.status === 'CANCELLED';

  return (
    <div>
      <div className="gc-stage-track">
        {PROJECT_STAGES.map((stage, index) => {
          const isDone = index < currentIndex;
          const isCurrent = index === currentIndex && !cancelled;
          const dotClass = cancelled && isCurrent ? 'cancelled' : isDone || isCurrent ? (isDone ? 'done' : 'current') : '';
          const lineClass = index <= currentIndex && !cancelled ? 'done' : '';
          return (
            <Fragment key={stage.key}>
              {index > 0 && <span className={`gc-stage-line ${lineClass}`} />}
              <div className="gc-stage-node">
                <span className={`gc-stage-dot ${dotClass}`}>{index + 1}</span>
                <span className={`gc-stage-label ${isCurrent ? 'current' : ''}`}>{stage.label}</span>
              </div>
            </Fragment>
          );
        })}
      </div>
      {cancelled && (
        <p className="mt-2 text-xs font-semibold text-red-700">
          This project was cancelled — execution has halted.
        </p>
      )}
    </div>
  );
}