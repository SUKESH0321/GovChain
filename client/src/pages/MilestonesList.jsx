import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import DataTable from '../components/ui/DataTable';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import LoadingState from '../components/ui/LoadingState';
import Modal from '../components/ui/Modal';
import StatusBadge from '../components/ui/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import useTable from '../hooks/useTable';
import { updateMilestoneStatus } from '../services/milestone.service';
import { getTenders } from '../services/tender.service';
import { getAssignedTenders, loadAllMilestones } from '../utils/stats';

const MILESTONE_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];

// Stage 2.3 review states (SUBMITTED / VERIFIED / REJECTED) are not part of the
// Stage 1 dropdown. A milestone that already sits in one is shown as a disabled
// entry so the select still displays its real status; the lifecycle itself is
// driven from the project details page.
function statusOptions(current) {
  return current && !MILESTONE_STATUSES.includes(current)
    ? [current, ...MILESTONE_STATUSES]
    : MILESTONE_STATUSES;
}

export default function MilestonesList() {
  const { user } = useAuth();
  const toast = useToast();

  const [milestones, setMilestones] = useState(null);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [statusTarget, setStatusTarget] = useState(null);
  const [statusValue, setStatusValue] = useState('');
  const [updating, setUpdating] = useState(false);

  const canUpdateStatus =
    user.role === 'government_officer' || user.role === 'contractor';

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        let all = await loadAllMilestones();
        if (cancelled) {
          return;
        }
        if (user.role === 'contractor') {
          const { tenders } = await getTenders();
          if (cancelled) {
            return;
          }
          const ids = new Set(getAssignedTenders(tenders, user.id).map((t) => t.project_id));
          all = all.filter((m) => ids.has(m.project_id));
        }
        setMilestones(all);
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user.id, user.role]);

  const table = useTable(milestones || [], {
    searchKeys: ['title', 'project_name', 'status'],
    initialSort: { key: 'due_date', dir: 'asc' },
  });

  async function submitStatus(event) {
    event.preventDefault();
    if (!statusTarget || !statusValue) {
      return;
    }
    setUpdating(true);
    try {
      await updateMilestoneStatus(statusTarget.id, statusValue);
      setMilestones((current) =>
        current.map((m) => (m.id === statusTarget.id ? { ...m, status: statusValue } : m))
      );
      toast.success('Milestone status updated.');
      setStatusTarget(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUpdating(false);
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
          onClick={(e) => {
            e.stopPropagation();
            setExpandedId((current) => (current === row.id ? null : row.id));
          }}
        >
          {expandedId === row.id ? '−' : '+'}
        </button>
      ),
    },
    {
      key: 'title',
      label: 'Milestone',
      sortable: true,
      render: (m) => <span className="font-medium">{m.title}</span>,
    },
    {
      key: 'project',
      label: 'Project',
      render: (m) => (
        <Link
          to={`/projects/${m.project_id}`}
          className="gc-link"
          onClick={(e) => e.stopPropagation()}
        >
          {m.project_name || '—'}
        </Link>
      ),
    },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      sortable: true,
      render: (m) => `₹${Number(m.amount).toLocaleString('en-IN')}`,
    },
    { key: 'due_date', label: 'Due date', sortable: true, render: (m) => m.due_date || '—' },
    { key: 'status', label: 'Status', sortable: true, render: (m) => <StatusBadge status={m.status} /> },
    {
      key: 'actions',
      label: '',
      render: (m) =>
        canUpdateStatus ? (
          <button
            type="button"
            className="gc-btn gc-btn-outline gc-btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              setStatusTarget(m);
              setStatusValue(m.status);
            }}
          >
            Status
          </button>
        ) : null,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <p className="gc-eyebrow">Milestones</p>
        <h1 className="text-2xl mt-1">
          {user.role === 'contractor' ? 'My milestones' : 'Milestone register'}
        </h1>
      </div>

      {error ? (
        <ErrorState message={error} />
      ) : !milestones ? (
        <LoadingState rows={6} cols={6} />
      ) : (
        <div className="gc-panel gc-animate-entrance gc-stagger-1 border border-gray-200">
          <div className="px-4 pt-4 flex flex-wrap gap-2">
            <div className="gc-search-input flex-1 min-w-[200px]">
              <span className="gc-search-icon">⌕</span>
              <input
                className="gc-input"
                placeholder="Search milestones…"
                value={table.search}
                onChange={(e) => table.setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="p-4">
            <DataTable
              columns={columns}
              rows={table.rows}
              sort={table.sort}
              onSort={table.toggleSort}
              renderExpanded={(row) =>
                expandedId === row.id ? (
                  <tr key={`${row.id}-expanded`}>
                    <td colSpan={columns.length} className="gc-expanded-cell">
                      <p className="px-4 py-3 text-sm text-gray-600 whitespace-pre-line">
                        {row.description || 'No description provided.'}
                      </p>
                    </td>
                  </tr>
                ) : null
              }
              empty={
                <EmptyState
                  title={user.role === 'contractor' ? 'No assigned milestones' : 'No milestones yet'}
                  hint="Milestones are created from the project details page."
                />
              }
            />
          </div>
        </div>
      )}

      <Modal
        open={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        title="Update milestone status"
        width="440px"
        footer={
          <form onSubmit={submitStatus} className="contents">
            <button type="button" className="gc-btn gc-btn-outline" onClick={() => setStatusTarget(null)}>
              Cancel
            </button>
            <button type="submit" className="gc-btn gc-btn-primary" disabled={updating || !statusValue}>
              {updating ? 'Saving…' : 'Update status'}
            </button>
          </form>
        }
      >
        {statusTarget && (
          <div className="space-y-4">
            <p className="font-semibold">{statusTarget.title}</p>
            <div className="gc-field">
              <label className="gc-label">Status</label>
              <select
                value={statusValue}
                onChange={(e) => setStatusValue(e.target.value)}
                className="gc-select"
              >
                {statusOptions(statusValue).map((s) => (
                  <option key={s} value={s} disabled={!MILESTONE_STATUSES.includes(s)}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}