import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import ProjectStageTimeline, {
  PROJECT_STAGES,
  resolveProjectStage,
} from '../components/ProjectStageTimeline';
import CountUp from '../components/ui/CountUp';
import DataTable from '../components/ui/DataTable';
import Drawer from '../components/ui/Drawer';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';

import LoadingState from '../components/ui/LoadingState';
import StatusBadge from '../components/ui/StatusBadge';
import useProjects from '../hooks/useProjects';
import useTable from '../hooks/useTable';
import useTenders from '../hooks/useTenders';
import useWavesProfile from '../hooks/useWavesProfile';
import { loadAllMilestones } from '../utils/stats';

const PROJECT_STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

const STAGE_TONES = {
  planning: '#8b98a6',
  tender: '#a56b12',
  contract: '#4c45a3',
  execution: '#1b5fae',
  completion: '#1e7a4e',
};

function StatField({ label, value, prefix = '', delay = 1 }) {
  return (
    <div className={`bg-white p-4 gc-hover-lift gc-card-interactive gc-animate-entrance gc-stagger-${delay}`}>
      <p className="gc-eyebrow text-gray-500">{label}</p>
      <p
        className="text-3xl font-bold mt-2 tracking-tight transition-transform duration-300"
        style={{ fontFamily: 'var(--gc-font-display)', color: 'var(--gc-navy)' }}
      >
        {prefix}
        <CountUp value={value} />
      </p>
    </div>
  );
}

function Fact({ label, value }) {
  return (
    <div>
      <p className="gc-eyebrow">{label}</p>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}

function contractorForProject(project, tenders) {
  const tender = (tenders || []).find((t) => t.project_id === project.id && t.contractor_id);
  return tender ? tender.contractor_name : null;
}

// Progress as { label, percent } derived from the lifecycle stage.
function stageProgress(project, tenders) {
  const stage = resolveProjectStage(project, tenders || []);
  const index = PROJECT_STAGES.findIndex((s) => s.key === stage);
  return {
    label: PROJECT_STAGES[index].label,
    percent: ((index + 1) / PROJECT_STAGES.length) * 100,
  };
}

export default function OfficerDashboard() {
  const { projects, loading, error, refresh } = useProjects();
  const { tenders } = useTenders();
  const waves = useWavesProfile();
  const [milestones, setMilestones] = useState(null);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    loadAllMilestones()
      .then(setMilestones)
      .catch(() => setMilestones([]));
  }, []);

  const table = useTable(projects || [], {
    searchKeys: ['name', 'location'],
    initialSort: { key: 'name', dir: 'asc' },
  });

  const stats = useMemo(() => {
    if (!projects || !tenders || milestones === null) {
      return null;
    }
    const stageCounts = {};
    PROJECT_STAGES.forEach((s) => {
      stageCounts[s.key] = 0;
    });
    projects.forEach((p) => {
      const stage = resolveProjectStage(p, tenders);
      stageCounts[stage] = (stageCounts[stage] || 0) + 1;
    });
    return {
      totalProjects: projects.length,
      activeProjects: projects.filter(
        (p) => p.status !== 'COMPLETED' && p.status !== 'CANCELLED'
      ).length,
      totalTenders: tenders.length,
      activeTenders: tenders.filter((t) => t.status === 'OPEN' || t.status === 'ASSIGNED').length,
      pendingMilestones: milestones.filter((m) => m.status === 'PENDING').length,
      allocatedBudget: projects.reduce((sum, p) => sum + (Number(p.budget) || 0), 0),
      stageCounts,
    };
  }, [projects, tenders, milestones]);

  const projectMilestones = selected
    ? (milestones || []).filter((m) => m.project_id === selected.id)
    : [];
  const completedMilestones = projectMilestones.filter((m) => m.status === 'COMPLETED').length;

  const columns = [
    {
      key: 'name',
      label: 'Project',
      sortable: true,
      render: (p) => (
        <Link to={`/projects/${p.id}`} className="gc-link" onClick={(e) => e.stopPropagation()}>
          {p.name}
        </Link>
      ),
    },
    { key: 'location', label: 'Location', sortable: true, render: (p) => p.location || '—' },
    {
      key: 'budget',
      label: 'Budget',
      sortable: true,
      align: 'right',
      render: (p) => `₹${Number(p.budget).toLocaleString('en-IN')}`,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: 'progress',
      label: 'Progress',
      render: (p) => {
        const progress = stageProgress(p, tenders);
        return (
          <div className="min-w-[140px]">
            <p className="text-xs font-semibold">{progress.label}</p>
            <div className="h-1.5 rounded-full mt-1" style={{ background: 'var(--gc-line)' }}>
              <div
                className="h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${progress.percent}%`, background: 'var(--gc-green)' }}
              />
            </div>
          </div>
        );
      },
    },
    {
      key: 'contractor',
      label: 'Contractor',
      render: (p) => contractorForProject(p, tenders || []) || '—',
    },
    { key: 'end_date', label: 'Deadline', sortable: true, render: (p) => p.end_date || '—' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Hero: single GradientWaves instance, low opacity, subtle parallax. */}
      <section className="gc-hero">

        <div className="gc-waves-overlay" />
        <div className="gc-hero-body">
          <p className="gc-eyebrow">Officer console</p>
          <h1 className="text-2xl mt-1">Programme overview</h1>
          <p className="gc-hero-note">
            Projects, tenders and milestones across the programme — tracked from
            planning through to completion.
          </p>
          <div className="gc-hero-actions">
            <Link to="/projects/new" className="gc-btn gc-btn-primary">+ Create project</Link>
            <Link to="/tenders/new" className="gc-btn gc-btn-outline">+ Create tender</Link>
          </div>
        </div>
      </section>

      {loading ? (
        <LoadingState rows={4} cols={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : stats ? (
        <>
          <div
            className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2"
          >
            <StatField delay={1} label="Total projects" value={stats.totalProjects} />
            <StatField delay={2} label="Active projects" value={stats.activeProjects} />
            <StatField delay={3} label="Total tenders" value={stats.totalTenders} />
            <StatField delay={4} label="Active tenders" value={stats.activeTenders} />
            <StatField delay={5} label="Pending milestones" value={stats.pendingMilestones} />
            <StatField delay={5} label="Allocated budget" value={stats.allocatedBudget} prefix="₹" />
          </div>

          <div className="gc-panel gc-animate-entrance gc-stagger-2">
            <div className="gc-panel-head">
              <span className="font-semibold">Project pipeline</span>
              <span className="gc-eyebrow">By lifecycle stage</span>
            </div>
            <div className="gc-panel-body">
              <div
                className="flex h-5 overflow-hidden rounded-sm border"
                style={{ borderColor: 'var(--gc-line-strong)' }}
              >
                {PROJECT_STAGES.map((stage) =>
                  stats.stageCounts[stage.key] ? (
                    <div
                      key={stage.key}
                      title={`${stage.label}: ${stats.stageCounts[stage.key]}`}
                      style={{
                        width: `${(stats.stageCounts[stage.key] / (stats.totalProjects || 1)) * 100}%`,
                        background: STAGE_TONES[stage.key],
                        transition: 'width 400ms ease',
                      }}
                    />
                  ) : null
                )}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
                {PROJECT_STAGES.map((stage) => (
                  <span key={stage.key} className="flex items-center gap-2 text-xs text-gray-600">
                    <span
                      className="inline-block w-3 h-3"
                      style={{ background: STAGE_TONES[stage.key] }}
                    />
                    {stage.label} ({stats.stageCounts[stage.key]})
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="gc-panel">
            <div className="gc-panel-head">
              <span className="font-semibold">Project activity</span>
              <span className="text-xs text-gray-500">
                {table.rows.length} of {projects.length} shown
              </span>
            </div>
            <div className="px-4 pt-4 flex flex-wrap gap-2">
              <div className="gc-search-input flex-1 min-w-[200px]">
                <span className="gc-search-icon">⌕</span>
                <input
                  className="gc-input"
                  placeholder="Search projects…"
                  value={table.search}
                  onChange={(e) => table.setSearch(e.target.value)}
                />
              </div>
              <select
                className="gc-select"
                style={{ width: 'auto' }}
                value={table.statusFilter}
                onChange={(e) => table.setStatusFilter(e.target.value)}
              >
                <option value="">All statuses</option>
                {PROJECT_STATUSES.map((s) => (
                  <option key={s} value={s}>{s.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
            <div className="p-4">
              <DataTable
                columns={columns}
                rows={table.rows}
                sort={table.sort}
                onSort={table.toggleSort}
                onRowClick={(row) => setSelected(row)}
                empty={
                  <EmptyState
                    title="No projects"
                    hint="No projects match the current search or status filter."
                  />
                }
              />
            </div>
          </div>
        </>
      ) : null}

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? selected.name : ''}
        width="520px"
      >
        {selected && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={selected.status} />
              <span className="text-sm text-gray-500">Record #{selected.id}</span>
            </div>

            <div>
              <p className="gc-eyebrow mb-2">Lifecycle stage</p>
              <ProjectStageTimeline project={selected} tenders={tenders || []} />
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Fact label="Location" value={selected.location || '—'} />
              <Fact label="Budget" value={`₹${Number(selected.budget).toLocaleString('en-IN')}`} />
              <Fact label="Start" value={selected.start_date || '—'} />
              <Fact label="Deadline" value={selected.end_date || '—'} />
              <Fact
                label="Contractor"
                value={contractorForProject(selected, tenders || []) || 'Not assigned'}
              />
              <Fact
                label="Milestones"
                value={`${completedMilestones}/${projectMilestones.length} complete`}
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              <Link to={`/projects/${selected.id}`} className="gc-btn gc-btn-primary gc-btn-sm">
                Open full details
              </Link>
              <Link to={`/projects/${selected.id}/edit`} className="gc-btn gc-btn-outline gc-btn-sm">
                Edit
              </Link>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}