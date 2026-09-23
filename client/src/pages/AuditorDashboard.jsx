import { Fragment, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { PROJECT_STAGES, resolveProjectStage } from '../components/ProjectStageTimeline';
import CountUp from '../components/ui/CountUp';
import DataTable from '../components/ui/DataTable';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';

import LoadingState from '../components/ui/LoadingState';
import StatusBadge from '../components/ui/StatusBadge';
import { PaymentBlockchainHistory } from '../components/BlockchainAuditHistory';
import usePayments from '../hooks/usePayments';
import useProjects from '../hooks/useProjects';
import useTable from '../hooks/useTable';
import useTenders from '../hooks/useTenders';
import useWavesProfile from '../hooks/useWavesProfile';
import { loadAllMilestones } from '../utils/stats';

const PROJECT_STATUSES = ['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];

function StatCell({ label, value, prefix = '', delay = 1 }) {
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

export default function AuditorDashboard() {
  const { projects, loading, error, refresh } = useProjects();
  const { tenders } = useTenders();
  const waves = useWavesProfile();
  const [milestones, setMilestones] = useState([]);

  // Stage 3.1/3.2 · read-only view of every payment request/authorization/release
  // record, plus an on-demand on-chain history per payment.
  const { payments, loading: paymentsLoading, error: paymentsError } = usePayments();
  const [expandedPayments, setExpandedPayments] = useState(() => new Set());

  function togglePaymentHistory(id) {
    setExpandedPayments((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  useEffect(() => {
    loadAllMilestones()
      .then(setMilestones)
      .catch(() => setMilestones([]));
  }, []);

  const table = useTable(projects || [], {
    searchKeys: ['name', 'location'],
    initialSort: { key: 'name', dir: 'asc' },
  });

  const totals = useMemo(() => {
    if (!projects) {
      return null;
    }
    return {
      totalProjects: projects.length,
      activeProjects: projects.filter((p) => p.status !== 'COMPLETED' && p.status !== 'CANCELLED').length,
      totalTenders: tenders ? tenders.length : null,
      totalMilestones: milestones.length,
    };
  }, [projects, tenders, milestones]);

  const projectColumns = [
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
    { key: 'location', label: 'Location', render: (p) => p.location || '—' },
    {
      key: 'budget',
      label: 'Budget',
      align: 'right',
      render: (p) => `₹${Number(p.budget).toLocaleString('en-IN')}`,
    },
    {
      key: 'status',
      label: 'Status',
      render: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: 'stage',
      label: 'Stage',
      render: (p) => {
        const stage = resolveProjectStage(p, tenders || []);
        return PROJECT_STAGES.find((s) => s.key === stage)?.label || '—';
      },
    },
    { key: 'end_date', label: 'Deadline', sortable: true, render: (p) => p.end_date || '—' },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3 flex-wrap" style={{ background: 'var(--gc-amber-soft)' }}>
        <span className="gc-readonly">● Read only</span>
        <span className="text-sm text-gray-700">
          Inspection workspace — no changes can be made by this account.
        </span>
      </div>

      {/* Hero: single GradientWaves instance, low opacity, subtle parallax. */}
      <section className="gc-hero">

        <div className="gc-waves-overlay" />
        <div className="gc-hero-body">
          <p className="gc-eyebrow">Audit console</p>
          <h1 className="text-2xl mt-1">Programme inspection</h1>
          <p className="gc-hero-note">
            Read-only examination of projects, tenders and milestone records.
          </p>
        </div>
      </section>

      {loading ? (
        <LoadingState rows={4} cols={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : totals ? (
        <>
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-3"
          >
            <StatCell delay={1} label="Total projects" value={totals.totalProjects} />
            <StatCell delay={2} label="Active projects" value={totals.activeProjects} />
            <StatCell delay={3} label="Total tenders" value={totals.totalTenders} />
            <StatCell delay={4} label="Total milestones" value={totals.totalMilestones} />
          </div>

          <div className="gc-panel gc-animate-entrance gc-stagger-2">
            <div className="gc-panel-head">
              <span className="font-semibold">Programme register</span>
              <span className="text-xs text-gray-500">Projects — read only</span>
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
                columns={projectColumns}
                rows={table.rows}
                sort={table.sort}
                onSort={table.toggleSort}
                empty={
                  <EmptyState title="No projects" hint="No projects match the current filters." />
                }
              />
            </div>
          </div>

          <div className="gc-panel">
            <div className="gc-panel-head">
              <span className="font-semibold">Contract award records</span>
              <span className="text-xs text-gray-500">Tenders — read only</span>
            </div>
            <div className="p-4">
              {!tenders || tenders.length === 0 ? (
                <EmptyState title="No tenders" hint="No tender records have been created." />
              ) : (
                <div className="gc-table-scroll">
                  <table className="gc-table">
                    <thead>
                      <tr>
                        <th>Tender</th>
                        <th>Project</th>
                        <th className="text-right">Amount</th>
                        <th>Contractor</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tenders.map((tender) => (
                        <tr key={tender.id}>
                          <td className="font-medium">
                            <Link
                              to={`/tenders/${tender.id}`}
                              className="gc-link"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {tender.title}
                            </Link>
                          </td>
                          <td>
                            <Link
                              to={`/projects/${tender.project_id}`}
                              className="gc-link"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {tender.project_name || '—'}
                            </Link>
                          </td>
                          <td className="text-right">
                            ₹{Number(tender.tender_amount).toLocaleString('en-IN')}
                          </td>
                          <td>{tender.contractor_name || 'Not assigned'}</td>
                          <td><StatusBadge status={tender.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="gc-panel">
            <div className="gc-panel-head">
              <span className="font-semibold">Milestone status register</span>
              <span className="text-xs text-gray-500">{milestones.length} records — read only</span>
            </div>
            <div className="p-4">
              {milestones.length === 0 ? (
                <EmptyState title="No milestones" hint="No milestone records have been created." />
              ) : (
                <div className="gc-table-scroll">
                  <table className="gc-table">
                    <thead>
                      <tr>
                        <th>Milestone</th>
                        <th>Project</th>
                        <th className="text-right">Amount</th>
                        <th>Due date</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {milestones.slice(0, 20).map((milestone) => (
                        <tr key={milestone.id}>
                          <td className="font-medium">{milestone.title}</td>
                          <td>
                            <Link
                              to={`/projects/${milestone.project_id}`}
                              className="gc-link"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {milestone.project_name || '—'}
                            </Link>
                          </td>
                          <td className="text-right">
                            ₹{Number(milestone.amount).toLocaleString('en-IN')}
                          </td>
                          <td>{milestone.due_date || '—'}</td>
                          <td><StatusBadge status={milestone.status} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Stage 3.1 · read-only payment records register. */}
          <div className="gc-panel">
            <div className="gc-panel-head">
              <span className="font-semibold">Payment records</span>
              <span className="text-xs text-gray-500">
                {payments ? `${payments.length} records — read only` : 'read only'}
              </span>
            </div>
            <div className="p-4">
              {paymentsError ? (
                <ErrorState message={paymentsError} />
              ) : paymentsLoading ? (
                <LoadingState rows={2} cols={5} />
              ) : !payments || payments.length === 0 ? (
                <EmptyState title="No payments" hint="No payment records exist yet." />
              ) : (
                <div className="gc-table-scroll">
                  <table className="gc-table">
                    <thead>
                      <tr>
                        <th>Payment</th>
                        <th>Project</th>
                        <th>Tender</th>
                        <th>Milestone</th>
                        <th className="text-right">Amount</th>
                        <th>Status</th>
                        <th>Requested at</th>
                        <th>Authorized at</th>
                        <th>Released at</th>
                        <th>On-chain</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.slice(0, 20).map((payment) => (
                        <Fragment key={payment.id}>
                          <tr>
                            <td className="font-medium">#{payment.id}</td>
                            <td>
                              <Link
                                to={`/projects/${payment.project_id}`}
                                className="gc-link"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {payment.project_name || '—'}
                              </Link>
                            </td>
                            <td>{payment.tender_title || '—'}</td>
                            <td>{payment.milestone_title || '—'}</td>
                            <td className="text-right">
                              ₹{Number(payment.amount).toLocaleString('en-IN')}
                            </td>
                            <td><StatusBadge status={payment.status} /></td>
                            <td>
                              {payment.requested_at
                                ? String(payment.requested_at).slice(0, 16).replace('T', ' ')
                                : '—'}
                            </td>
                            <td>
                              {payment.authorized_at
                                ? String(payment.authorized_at).slice(0, 16).replace('T', ' ')
                                : '—'}
                            </td>
                            <td>
                              {payment.released_at
                                ? String(payment.released_at).slice(0, 16).replace('T', ' ')
                                : '—'}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="gc-btn gc-btn-outline gc-btn-sm"
                                onClick={() => togglePaymentHistory(payment.id)}
                              >
                                {expandedPayments.has(payment.id) ? 'Hide chain' : 'View chain'}
                              </button>
                            </td>
                          </tr>
                          {expandedPayments.has(payment.id) && (
                            <tr>
                              <td colSpan={10} className="bg-slate-50">
                                <PaymentBlockchainHistory paymentId={payment.id} />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="gc-panel">
            <div className="gc-panel-head">
              <span className="font-semibold">Examination trail</span>
            </div>
            <div className="gc-panel-body">
              <p className="text-sm text-gray-600">
                Project, tender and milestone records expose their created/updated
                timestamps. Field-level change history is{' '}
                <span className="font-semibold">not available</span> in the current
                backend — audit trails of individual edits will be introduced with
                later modules.
              </p>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}