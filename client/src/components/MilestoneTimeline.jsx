import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { MilestoneBlockchainHistory } from './BlockchainAuditHistory';
import MilestoneRiskPanel from './MilestoneRiskPanel';
import StatusBadge from './ui/StatusBadge';
import { requestPayment } from '../services/payment.service';

// Statuses that the Stage 1 dropdown may set. SUBMITTED / VERIFIED / REJECTED are
// reached through the Stage 2.3 lifecycle buttons below so that each review step
// is recorded on the blockchain.
const MILESTONE_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];

// A milestone in one of these states is already handed in / finished.
const SUBMIT_BLOCKED_STATUSES = ['SUBMITTED', 'VERIFIED', 'COMPLETED'];

function isOverdue(milestone) {
  if (!milestone.due_date || milestone.status === 'COMPLETED') {
    return false;
  }
  return milestone.due_date < new Date().toISOString().slice(0, 10);
}

// Stage 3.1 · inline "Request Payment" control shown to contractors on a VERIFIED
// milestone. The amount defaults to the milestone amount and can be adjusted
// before the request is submitted to POST /api/payments. `existingPayment` (a
// previously created request for this milestone) is displayed as its status.
function fmt(value) {
  return value ? String(value).slice(0, 16).replace('T', ' ') : '—';
}

function formatAmount(amount) {
  return amount === null || amount === undefined
    ? '—'
    : `₹${Number(amount).toLocaleString('en-IN')}`;
}

function PaymentRequestControl({ milestone, existingPayment }) {
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState(String(Number(milestone.amount) || ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [payment, setPayment] = useState(null);

  const current = payment || existingPayment || null;

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const data = await requestPayment(milestone.id, Number(amount));
      setPayment(data.payment);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (current) {
    // Stage 3.2 · contractors see the full payment timeline. Released payments
    // are clearly labelled as simulated — no real funds were transferred.
    return (
      <div className="mt-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 text-sm">
          <span className="gc-eyebrow">Payment status</span>
          <StatusBadge status={current.status} />
          <span className="text-gray-500">
            ₹{Number(current.amount).toLocaleString('en-IN')}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Requested: {fmt(current.requested_at)} · Authorized: {fmt(current.authorized_at)} ·
          Released: {fmt(current.released_at)}
        </p>
        {current.status === 'RELEASED' && (
          <p className="text-xs text-gray-400 mt-0.5">
            Simulated release (demo) — no real funds were transferred.
          </p>
        )}
        {current.status === 'REJECTED' && current.reason && (
          <p className="text-xs text-red-600 mt-0.5">Reason: {current.reason}</p>
        )}
      </div>
    );
  }

  if (!editing) {
    return (
      <div className="mt-2" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="gc-btn gc-btn-primary gc-btn-sm gc-interactive"
          disabled={busy}
          onClick={() => setEditing(true)}
        >
          Request payment
        </button>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <form
      className="mt-2 flex flex-wrap items-center gap-2"
      onClick={(e) => e.stopPropagation()}
      onSubmit={submit}
    >
      <label className="gc-eyebrow" htmlFor={`payment-amount-${milestone.id}`}>
        Payment amount (₹)
      </label>
      <input
        id={`payment-amount-${milestone.id}`}
        type="number"
        min="1"
        step="0.01"
        className="gc-input text-sm"
        style={{ width: '160px' }}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
      />
      <button type="submit" className="gc-btn gc-btn-primary gc-btn-sm" disabled={busy}>
        {busy ? 'Requesting…' : 'Submit request'}
      </button>
      <button
        type="button"
        className="gc-btn gc-btn-sm"
        disabled={busy}
        onClick={() => setEditing(false)}
      >
        Cancel
      </button>
      {error && <p className="text-xs text-red-600 w-full">{error}</p>}
    </form>
  );
}

// Chronological milestone timeline with expand/collapse, status controls and the
// Stage 2.3 lifecycle actions (submit / verify / reject). The lifecycle callbacks
// are optional: when a role may not perform them the parent simply omits them.
export default function MilestoneTimeline({
  milestones,
  canUpdate,
  onStatusChange,
  onEdit,
  updatingId,
  onSubmit,
  onVerify,
  onReject,
  canRequestPayment,
  payments,
}) {
  const [openId, setOpenId] = useState(null);

  // Stage 3.1 · latest payment per milestone, so a request survives page reloads.
  const paymentByMilestone = useMemo(() => {
    const map = {};
    (payments || []).forEach((p) => {
      if (!map[p.milestone_id] || p.id > map[p.milestone_id].id) {
        map[p.milestone_id] = p;
      }
    });
    return map;
  }, [payments]);

  const sorted = [...milestones].sort((a, b) => {
    const aDate = a.due_date || '9999';
    const bDate = b.due_date || '9999';
    return String(aDate).localeCompare(String(bDate)) || a.id - b.id;
  });

  return (
    <div>
      {sorted.map((milestone, idx) => {
        const overdue = isOverdue(milestone);
        const expanded = openId === milestone.id;
        const busy = updatingId === milestone.id;
        const reviewable = milestone.status === 'SUBMITTED';
        // Review states are not part of the Stage 1 dropdown, so they are shown
        // as a disabled entry to keep the select value truthful.
        const statusOptions = MILESTONE_STATUSES.includes(milestone.status)
          ? MILESTONE_STATUSES
          : [milestone.status, ...MILESTONE_STATUSES];
        return (
          <div
            key={milestone.id}
            className={`gc-milestone status-${milestone.status} ${overdue ? 'overdue' : ''} gc-hover-lift gc-card-interactive gc-animate-entrance gc-stagger-${Math.min(idx + 1, 5)} transition-colors cursor-pointer border rounded-md p-3 mb-3 hover:border-gray-300`}
            onClick={() => setOpenId(expanded ? null : milestone.id)}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className="text-left font-semibold text-gray-800"
                  >
                    {milestone.title}
                  </span>
                  <StatusBadge status={milestone.status} />
                  {overdue && <span className="text-xs font-bold text-red-700">OVERDUE</span>}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Amount {Number(milestone.amount).toLocaleString('en-IN')} · Due{' '}
                  {milestone.due_date || '—'}
                </p>

                {/* Stage 3.1/3.3 · payment section on the milestone. Contractors
                    can request a payment on a VERIFIED milestone; every role sees
                    the current payment state once one exists. */}
                {canRequestPayment && milestone.status === 'VERIFIED' && (
                  <PaymentRequestControl
                    milestone={milestone}
                    existingPayment={paymentByMilestone[milestone.id] || null}
                  />
                )}
                {!canRequestPayment &&
                  (paymentByMilestone[milestone.id] ? (
                    <div className="mt-2 text-sm">
                      <p className="gc-eyebrow">Payment</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span>{formatAmount(milestone.amount)}</span>
                        <StatusBadge status={paymentByMilestone[milestone.id].status} />
                        <span className="text-xs text-gray-500">
                          Requested {fmt(paymentByMilestone[milestone.id].requested_at)}
                          {paymentByMilestone[milestone.id].authorized_at &&
                            ` · Authorized ${fmt(paymentByMilestone[milestone.id].authorized_at)}`}
                          {paymentByMilestone[milestone.id].released_at &&
                            ` · Released ${fmt(paymentByMilestone[milestone.id].released_at)}`}
                        </span>
                        <Link
                          to="/payments"
                          className="gc-btn gc-btn-outline gc-btn-sm"
                          onClick={(e) => e.stopPropagation()}
                        >
                          View Payment
                        </Link>
                      </div>
                      {paymentByMilestone[milestone.id].status === 'RELEASED' && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Simulated release (demo) — no real funds were transferred.
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-gray-400">No payment requested</p>
                  ))}
              </div>

              {canUpdate && onStatusChange && (
                <div onClick={(e) => e.stopPropagation()}>
                  <select
                    value={milestone.status}
                    disabled={busy}
                    onChange={(e) => onStatusChange(milestone, e.target.value)}
                    className="gc-select text-sm gc-interactive"
                    style={{ width: 'auto' }}
                  >
                    {statusOptions.map((s) => (
                      <option key={s} value={s} disabled={!MILESTONE_STATUSES.includes(s)}>
                        {s.replace('_', ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(onSubmit || onVerify || onReject) && (
                <div
                  className="flex flex-wrap items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  {onSubmit && !SUBMIT_BLOCKED_STATUSES.includes(milestone.status) && (
                    <button
                      type="button"
                      className="gc-btn gc-btn-outline gc-btn-sm gc-interactive"
                      disabled={busy}
                      onClick={() => onSubmit(milestone)}
                    >
                      Submit
                    </button>
                  )}
                  {onVerify && reviewable && (
                    <button
                      type="button"
                      className="gc-btn gc-btn-blue gc-btn-sm gc-interactive"
                      disabled={busy}
                      onClick={() => onVerify(milestone)}
                    >
                      Verify
                    </button>
                  )}
                  {onReject && reviewable && (
                    <button
                      type="button"
                      className="gc-btn gc-btn-danger gc-btn-sm gc-interactive"
                      disabled={busy}
                      onClick={() => onReject(milestone)}
                    >
                      Reject
                    </button>
                  )}
                </div>
              )}

              {onEdit && (
                <button
                  type="button"
                  className="gc-btn gc-btn-outline gc-btn-sm"
                  onClick={() => onEdit(milestone)}
                >
                  Edit
                </button>
              )}
            </div>

            {expanded && (
              <div className="mt-2 text-sm text-gray-600">
                {milestone.description ? (
                  <p className="whitespace-pre-line">{milestone.description}</p>
                ) : (
                  <p className="text-gray-400">No description provided.</p>
                )}

                {/* Stage 2.4 · this milestone's own on-chain lifecycle, read from
                    the contract event logs when the milestone is expanded. */}
                <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                  <MilestoneBlockchainHistory milestoneId={milestone.id} />
                </div>

                {/* Stage 4.2 · focused risk indicators for this milestone
                    (amount, status, timeline and its payments), calculated on
                    request by the backend risk engine. Read-only. */}
                <div onClick={(e) => e.stopPropagation()}>
                  <MilestoneRiskPanel milestoneId={milestone.id} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}