import { useState } from 'react';
import { Link } from 'react-router-dom';

import ProjectForm from '../components/ProjectForm';
import ProjectStageTimeline, {
  PROJECT_STAGES,
  resolveProjectStage,
} from '../components/ProjectStageTimeline';
import DataTable from '../components/ui/DataTable';
import Drawer from '../components/ui/Drawer';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import LoadingState from '../components/ui/LoadingState';
import StatusBadge from '../components/ui/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import useMilestones from '../hooks/useMilestones';
import useProjects from '../hooks/useProjects';
import useTable from '../hooks/useTable';
import useTenders from '../hooks/useTenders';

const PROJECT_STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

function contractorForProject(project, tenders) {
  const tender = (tenders || []).find((t) => t.project_id === project.id && t.contractor_id);
  return tender ? tender.contractor_name : null;
}

function stageLabel(project, tenders) {
  const stage = resolveProjectStage(project, tenders || []);
  return PROJECT_STAGES.find((s) => s.key === stage)?.label || '—';
}

export default function ProjectsList() {
  const { user } = useAuth();
  const toast = useToast();
  const { projects, loading, error, refresh, addProject, editProject } = useProjects();
  const { tenders } = useTenders();
  const [selected, setSelected] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const { milestones } = useMilestones(selected?.id);
  const completedCount = milestones
    ? milestones.filter((m) => m.status === 'COMPLETED').length
    : 0;
  const isOfficer = user.role === 'government_officer';

  const table = useTable(projects || [], {
    searchKeys: ['name', 'location'],
    initialSort: { key: 'name', dir: 'asc' },
  });

  function toggleExpand(row) {
    setExpandedId((current) => (current === row.id ? null : row.id));
  }

  async function handleCreate(payload) {
    setSaving(true);
    try {
      await addProject(payload);
      toast.success('Project created.');
      setCreateOpen(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit(payload) {
    setSaving(true);
    try {
      await editProject(editTarget.id, payload);
      toast.success('Project updated.');
      setEditTarget(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    {
      key: '_expand',
      label: '',
      render: (row) => (
        <button
          type="button"
          className="gc-btn gc-btn-outline gc-btn-sm"
          aria-label={expandedId === row.id ? 'Collapse row' : 'Expand row'}
          onClick={(e) => {
            e.stopPropagation();
            toggleExpand(row);
          }}
        >
          {expandedId === row.id ? '−' : '+'}
        </button>
      ),
    },
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
    { key: 'status', label: 'Status', sortable: true, render: (p) => <StatusBadge status={p.status} /> },
    { key: 'progress', label: 'Progress', sortable: true, render: (p) => stageLabel(p, tenders) },
    { key: 'contractor', label: 'Contractor', render: (p) => contractorForProject(p, tenders || []) || '—' },
    { key: 'end_date', label: 'Deadline', sortable: true, render: (p) => p.end_date || '—' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="gc-eyebrow">Projects</p>
          <h1 className="text-2xl mt-1">
            {user.role === 'contractor' ? 'My projects' : 'Project register'}
          </h1>
        </div>
        {isOfficer && (
          <button type="button" className="gc-btn gc-btn-primary" onClick={() => setCreateOpen(true)}>
            + Create project
          </button>
        )}
      </div>

      {loading ? (
        <LoadingState rows={6} cols={7} />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <div className="gc-panel gc-animate-entrance gc-stagger-1 border border-gray-200">
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
              renderExpanded={(row) =>
                expandedId === row.id ? (
                  <tr key={`${row.id}-expanded`}>
                    <td colSpan={columns.length} className="gc-expanded-cell">
                      <div className="px-4 py-3">
                        <div className="grid md:grid-cols-3 gap-4 text-sm">
                          <div className="md:col-span-2">
                            <p className="gc-eyebrow mb-1">Description</p>
                            <p className="whitespace-pre-line text-gray-600">
                              {row.description || 'No description provided.'}
                            </p>
                          </div>
                          <div>
                            <p className="gc-eyebrow mb-2">Lifecycle stage</p>
                            <ProjectStageTimeline project={row} tenders={tenders || []} />
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                          {isOfficer && (
                            <button
                              type="button"
                              className="gc-btn gc-btn-outline gc-btn-sm"
                              onClick={() => setEditTarget(row)}
                            >
                              Edit
                            </button>
                          )}
                          <Link to={`/projects/${row.id}`} className="gc-btn gc-btn-primary gc-btn-sm">
                            Open details
                          </Link>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null
              }
              empty={
                <EmptyState
                  title={user.role === 'contractor' ? 'No assigned projects' : 'No projects yet'}
                  hint={
                    user.role === 'contractor'
                      ? 'Projects appear here once a tender is assigned to you.'
                      : 'Create a project or clear the current filters.'
                  }
                />
              }
            />
          </div>
        </div>
      )}

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? selected.name : ''}
        width="540px"
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
              <Info label="Location" value={selected.location || '—'} />
              <Info label="Budget" value={`₹${Number(selected.budget).toLocaleString('en-IN')}`} />
              <Info label="Start date" value={selected.start_date || '—'} />
              <Info label="Deadline" value={selected.end_date || '—'} />
              <Info
                label="Contractor"
                value={contractorForProject(selected, tenders || []) || 'Not assigned'}
              />
              <Info label="Milestones" value={`${completedCount}/${milestones.length || 0} complete`} />
            </div>

            <div className="flex gap-2 flex-wrap">
              <Link to={`/projects/${selected.id}`} className="gc-btn gc-btn-primary gc-btn-sm">
                Open full details
              </Link>
              {isOfficer && (
                <button
                  type="button"
                  className="gc-btn gc-btn-outline gc-btn-sm"
                  onClick={() => {
                    setEditTarget(selected);
                    setSelected(null);
                  }}
                >
                  Edit
                </button>
              )}
            </div>
          </div>
        )}
      </Drawer>

      {isOfficer && (
        <>
          <Drawer open={createOpen} onClose={() => setCreateOpen(false)} title="Create project" width="560px">
            <ProjectForm key="create-project" onSubmit={handleCreate} submitLabel="Create project" submitting={saving} />
          </Drawer>
          <Drawer
            open={!!editTarget}
            onClose={() => setEditTarget(null)}
            title="Edit project"
            width="560px"
          >
            {editTarget && (
              <ProjectForm
                key={`edit-project-${editTarget.id}`}
                initial={editTarget}
                onSubmit={handleEdit}
                submitLabel="Save changes"
                submitting={saving}
              />
            )}
          </Drawer>
        </>
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="gc-eyebrow">{label}</p>
      <p className="mt-0.5">{value}</p>
    </div>
  );
}