import { useState } from 'react';

import StatusBadge from './ui/StatusBadge';

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
}) {
  const [openId, setOpenId] = useState(null);

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
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}