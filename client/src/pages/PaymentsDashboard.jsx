import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import CountUp from '../components/ui/CountUp';
import Drawer from '../components/ui/Drawer';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import LoadingState from '../components/ui/LoadingState';
import StatusBadge from '../components/ui/StatusBadge';
import { PaymentBlockchainHistory } from '../components/BlockchainAuditHistory';
import PaymentRiskIndicator from '../components/PaymentRiskIndicator';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import usePayments from '../hooks/usePayments';

// GovChain — Stage 3.3 · unified payment dashboard.
//
// One page, three role-aware views over the same payment records:
//   - Government Officer: management table (Authorize / Reject / Release Payment
//     depending on the current status) plus aggregate summary figures.
//   - Contractor: own payment records only (the backend RBAC enforces this).
//   - Auditor: strictly read-only register including who requested/authorized/
//     released each payment.
// The payment details drawer shows the application timeline from PostgreSQL and,
// where available, the real PaymentAuthorized / PaymentReleased events read from
// the GovChain contract logs (never fabricated from the database).

const PAYMENT_STATUSES = ['REQUESTED', 'AUTHORIZED', 'RELEASED', 'REJECTED'];

function formatDateTime(value) {
  return value ? String(value).slice(0, 16).replace('T', ' ') : '—';
}

function formatAmount(amount) {
  return amount === null || amount === undefined
    ? '—'
    : `₹${Number(amount).toLocaleString('en-IN')}`;
}

function Detail({ label, value }) {
  return (
    <div>
      <p className="gc-eyebrow">{label}</p>
      <p className="mt-0.5 text-sm">{value ?? '—'}</p>
    </div>
  );
}

function StatCell({ label, value, delay = 1, prefix = '' }) {
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

// Application-side lifecycle, from PostgreSQL timestamps only. Each step is
// shown only when it actually happened (no invented data).
function PaymentTimeline({ payment }) {
  const steps = [
    { label: 'Payment requested', at: payment.requested_at, by: payment.requested_by_name },
    {
      label: payment.status === 'REJECTED' ? 'Payment rejected' : 'Payment authorized',
      at: payment.status === 'REJECTED' ? null : payment.authorized_at,
      by: payment.status === 'REJECTED' ? null : payment.authorized_by_name,
      extra: payment.status === 'REJECTED' && payment.reason ? payment.reason : null,
    },
    {
      label: 'Payment released (simulated)',
      at: payment.released_at,
      by: payment.released_by_name,
    },
  ].filter((step) => step.at || step.extra);

  return (
    <ol className="space-y-2 text-sm">
      {steps.map((step) => (
        <li key={step.label} className="flex flex-wrap items-baseline gap-2">
          <span className="font-medium text-gray-800">{step.label}</span>
          {step.at && <span className="text-xs text-gray-500">{formatDateTime(step.at)}</span>}
          {step.by && <span className="text-xs text-gray-500">· by {step.by}</span>}
          {step.extra && <span className="text-xs text-red-600">· {step.extra}</span>}
        </li>
      ))}
    </ol>
  );
}

export default function PaymentsDashboard() {
  const { user } = useAuth();
  const toast = useToast();

  const isOfficer = user.role === 'government_officer';
  const isAuditor = user.role === 'auditor';
  const isContractor = user.role === 'contractor';

  const { payments, loading, error, refresh, authorize, reject, release } = usePayments();

  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState(null); // full payment object
  const [busyId, setBusyId] = useState(null);

  const filtered = useMemo(() => {
    if (!payments) {
      return null;
    }
    if (!statusFilter) {
      return payments;
    }
    return payments.filter((p) => p.status === statusFilter);
  }, [payments, statusFilter]);

  // Stage 3.3 · informational summary figures — not accounting records.
  const summary = useMemo(() => {
    if (!payments) {
      return null;
    }
    const byStatus = (status) => payments.filter((p) => p.status === status);
    const sum = (list) => list.reduce((total, p) => total + (Number(p.amount) || 0), 0);
    return {
      total: payments.length,
      requested: byStatus('REQUESTED').length,
      authorized: byStatus('AUTHORIZED').length,
      released: byStatus('RELEASED').length,
      rejected: byStatus('REJECTED').length,
      authorizedAmount: sum(byStatus('AUTHORIZED')),
      releasedAmount: sum(byStatus('RELEASED')),
    };
  }, [payments]);

  async function runAction(payment, action) {
    setBusyId(payment.id);
    try {
      if (action === 'authorize') {
        await authorize(payment.id);
        toast.success('Payment authorized.');
      } else if (action === 'reject') {
        await reject(payment.id, '');
        toast.success('Payment request rejected.');
      } else if (action === 'release') {
        await release(payment.id);
        toast.success('Payment released (simulated).');
      }
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  }

  // Officer actions depend strictly on the current status; terminal states
  // (RELEASED / REJECTED) expose no actions at all.
  function renderActions(payment) {
    if (!isOfficer) {
      return null;
    }
    if (payment.status === 'REQUESTED') {
      return (
        <>
          <button
            type="button"
            className="gc-btn gc-btn-blue gc-btn-sm gc-interactive"
            disabled={busyId === payment.id}
            onClick={(e) => {
              e.stopPropagation();
              runAction(payment, 'authorize');
            }}
          >
            Authorize
          </button>
          <button
            type="button"
            className="gc-btn gc-btn-danger gc-btn-sm gc-interactive"
            disabled={busyId === payment.id}
            onClick={(e) => {
              e.stopPropagation();
              runAction(payment, 'reject');
            }}
          >
            Reject
          </button>
        </>
      );
    }
    if (payment.status === 'AUTHORIZED') {
      return (
        <button
          type="button"
          className="gc-btn gc-btn-primary gc-btn-sm gc-interactive"
          disabled={busyId === payment.id}
          onClick={(e) => {
            e.stopPropagation();
            runAction(payment, 'release');
          }}
        >
          {busyId === payment.id ? 'Releasing…' : 'Release Payment'}
        </button>
      );
    }
    return (
      <span className="text-xs text-gray-400">
        {payment.status === 'RELEASED' ? 'Released' : 'Rejected'}
      </span>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <section className="gc-hero">
        <div className="gc-waves-overlay" />
        <div className="gc-hero-body">
          <p className="gc-eyebrow">Payments</p>
          <h1 className="text-2xl mt-1">
            {isContractor
              ? 'My payments'
              : isAuditor
                ? 'Payment audit register'
                : 'Payment management'}
          </h1>
          <p className="gc-hero-note">
            {isContractor
              ? 'Payment requests you raised against verified milestones, with their status.'
              : isAuditor
                ? 'Read-only register of every payment. Open one to see its on-chain audit trail.'
                : 'Review requests, authorize or reject them, and release authorized payments (simulated).'}
          </p>
        </div>
      </section>

      {error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : !payments ? (
        <LoadingState rows={4} cols={5} />
      ) : (
        <>
          {summary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCell delay={1} label="Total payment requests" value={summary.total} />
              <StatCell delay={2} label="Requested" value={summary.requested} />
              <StatCell delay={2} label="Authorized payments" value={summary.authorized} />
              <StatCell delay={3} label="Released payments" value={summary.released} />
              <StatCell delay={3} label="Rejected payments" value={summary.rejected} />
              <StatCell
                delay={4}
                label="Total authorized amount"
                value={summary.authorizedAmount}
                prefix="₹"
              />
              <StatCell
                delay={4}
                label="Total released amount"
                value={summary.releasedAmount}
                prefix="₹"
              />
            </div>
          )}

          <div className="gc-panel gc-animate-entrance gc-stagger-2">
            <div className="gc-panel-head">
              <span className="font-semibold">Payment records</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500">
                  {filtered ? `${filtered.length} of ${payments.length} shown` : ''}
                </span>
                <select
                  className="gc-select text-sm"
                  style={{ width: 'auto' }}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  aria-label="Filter by status"
                >
                  <option value="">All</option>
                  {PAYMENT_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <button type="button" className="gc-btn gc-btn-outline gc-btn-sm" onClick={refresh}>
                  Refresh
                </button>
              </div>
            </div>
            <div className="p-4">
              {!filtered || filtered.length === 0 ? (
                <EmptyState
                  title="No payments found"
                  hint={
                    statusFilter
                      ? 'No payment records match the selected status filter.'
                      : isContractor
                        ? 'Request a payment on a verified milestone and it will appear here.'
                        : 'Payment requests will appear here as contractors raise them.'
                  }
                />
              ) : (
                <div className="gc-table-scroll">
                  <table className="gc-table">
                    <thead>
                      <tr>
                        <th>Payment</th>
                        <th>Project</th>
                        {isAuditor && <th>Tender</th>}
                        <th>Milestone</th>
                        <th>Contractor</th>
                        <th className="text-right">Amount</th>
                        <th>Status</th>
                        <th>Requested at</th>
                        <th>Authorized at</th>
                        <th>Released at</th>
                        {isAuditor && <th>Requested by</th>}
                        {isAuditor && <th>Authorized by</th>}
                        {isAuditor && <th>Released by</th>}
                        {(isOfficer || isAuditor) && <th>On-chain</th>}
                        {isOfficer && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((payment) => (
                        <tr
                          key={payment.id}
                          className="cursor-pointer"
                          onClick={() => setSelected(payment)}
                        >
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
                          {isAuditor && <td>{payment.tender_title || '—'}</td>}
                          <td>{payment.milestone_title || '—'}</td>
                          <td>{payment.contractor_name || '—'}</td>
                          <td className="text-right">{formatAmount(payment.amount)}</td>
                          <td><StatusBadge status={payment.status} /></td>
                          <td>{formatDateTime(payment.requested_at)}</td>
                          <td>{formatDateTime(payment.authorized_at)}</td>
                          <td>{formatDateTime(payment.released_at)}</td>
                          {isAuditor && <td>{payment.requested_by_name || '—'}</td>}
                          {isAuditor && <td>{payment.authorized_by_name || '—'}</td>}
                          {isAuditor && <td>{payment.released_by_name || '—'}</td>}
                          {(isOfficer || isAuditor) && (
                            <td onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                className="gc-btn gc-btn-outline gc-btn-sm"
                                onClick={() => setSelected(payment)}
                              >
                                View
                              </button>
                            </td>
                          )}
                          {isOfficer && (
                            <td>
                              <div
                                className="flex items-center gap-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {renderActions(payment)}
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>


          {isOfficer && (
            <p className="text-xs text-gray-500">
              Releasing a payment is a simulated demo action — no real funds are transferred.
            </p>
          )}
        </>
      )}

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Payment #${selected.id}` : ''}
        width="560px"
      >
        {selected && (
          <div className="space-y-6">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={selected.status} />
              <span className="text-sm text-gray-500">{formatAmount(selected.amount)}</span>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Detail label="Project" value={selected.project_name || '—'} />
              <Detail label="Tender" value={selected.tender_title || '—'} />
              <Detail label="Milestone" value={selected.milestone_title || '—'} />
              <Detail label="Contractor" value={selected.contractor_name || '—'} />
              <Detail label="Amount" value={formatAmount(selected.amount)} />
              <Detail label="Status" value={selected.status} />
            </div>

            <hr className="gc-divider" />

            {/* Stage 4.3 · advisory risk indicators for this payment, derived
                from the existing Stage 4.2 project analysis. Display only — it
                never blocks, authorizes or releases a payment. */}
            <div>
              <p className="gc-eyebrow mb-2">AI risk</p>
              <PaymentRiskIndicator payment={selected} />
            </div>

            <div>
              <p className="gc-eyebrow mb-2">Payment history</p>
              <PaymentTimeline payment={selected} />
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <Detail label="Requested by" value={selected.requested_by_name || '—'} />
              <Detail label="Requested at" value={formatDateTime(selected.requested_at)} />
              {selected.authorized_at && (
                <>
                  <Detail label="Authorized by" value={selected.authorized_by_name || '—'} />
                  <Detail label="Authorized at" value={formatDateTime(selected.authorized_at)} />
                </>
              )}
              {selected.released_at && (
                <>
                  <Detail label="Released by" value={selected.released_by_name || '—'} />
                  <Detail label="Released at" value={formatDateTime(selected.released_at)} />
                </>
              )}
            </div>

            {selected.status === 'REJECTED' && selected.reason && (
              <Detail label="Rejection reason" value={selected.reason} />
            )}

            <hr className="gc-divider" />

            {/* Real PaymentAuthorized / PaymentReleased events read from the
                GovChain contract event logs. If the chain is temporarily
                unavailable the component shows an error state while the payment
                information above stays visible — nothing is fabricated. */}
            <PaymentBlockchainHistory paymentId={selected.id} />
          </div>
        )}
      </Drawer>

    </div>
  );
}
