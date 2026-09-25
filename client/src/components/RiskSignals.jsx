// GovChain — Stage 4.2 · shared pieces of the AI risk UI.
//
// The wording is deliberate throughout: these are *risk indicators that require
// review*. Nothing here states or implies that fraud, corruption or a crime was
// proven, and no value is ever invented — every figure comes from the analysis
// the backend calculated from the real GovChain records.

export const LEVEL_TONE = { LOW: 'tone-green', MEDIUM: 'tone-amber', HIGH: 'tone-red' };
export const SEVERITY_TONE = { LOW: 'tone-slate', MEDIUM: 'tone-amber', HIGH: 'tone-red' };
export const LEVEL_BAR = {
  LOW: 'bg-[var(--gc-green)]',
  MEDIUM: 'bg-[var(--gc-amber)]',
  HIGH: 'bg-[var(--gc-red)]',
};

export const LEVEL_HEADLINE = {
  LOW: 'No significant risk indicator detected in the current records.',
  MEDIUM: 'Potential anomalies detected — requires review.',
  HIGH: 'Multiple or blocking anomalies detected — requires review.',
};

// The rule families the engine evaluates (see risk.service.js).
export const SIGNAL_LABELS = {
  TENDER_BUDGET_ANOMALY: 'Budget / tender amount',
  MILESTONE_ALLOCATION_ANOMALY: 'Milestone allocation',
  PAYMENT_MILESTONE_RATIO: 'Payment vs milestone amount',
  PAYMENT_CUMULATIVE_ANOMALY: 'Cumulative payments',
  MULTIPLE_PAYMENT_MILESTONE: 'Multiple payments for one milestone',
  PROGRESS_PAYMENT_ANOMALY: 'Milestone progress vs payment',
  PAYMENT_WORKFLOW_ANOMALY: 'Payment / milestone workflow',
  MILESTONE_TIMELINE_ANOMALY: 'Milestone timeline',
  PAYMENT_TIMELINE_ANOMALY: 'Payment timeline',
  CONTRACTOR_CONCENTRATION: 'Contractor payment concentration',
};

// Cross-entity grouping of the signals (project · tender · milestone · payment ·
// timeline · contractor).
export const CATEGORY_LABELS = {
  TENDER: 'Tender',
  MILESTONE: 'Milestone',
  PAYMENT: 'Payment',
  TIMELINE: 'Timeline',
  CONTRACTOR: 'Contractor',
  PROJECT: 'Project',
};

export const EVIDENCE_LABELS = {
  projectBudget: 'Project budget',
  tenderAmount: 'Tender amount',
  tenderId: 'Tender ID',
  tenderTitle: 'Tender',
  totalMilestoneAmount: 'Milestone allocation',
  milestoneId: 'Milestone ID',
  milestoneTitle: 'Milestone',
  milestoneAmount: 'Milestone amount',
  milestoneTotal: 'Milestone total',
  milestoneCount: 'Milestones',
  milestoneStatus: 'Milestone status',
  milestoneDueDate: 'Milestone due date',
  milestoneCreated: 'Milestone recorded',
  paymentId: 'Payment ID',
  paymentStatus: 'Payment status',
  paymentAmount: 'Payment amount',
  paymentsTotal: 'Payments total',
  paymentCount: 'Payments',
  releasedTotal: 'Released total',
  largestPaymentAmount: 'Largest payment',
  largestPaymentId: 'Largest payment ID',
  requestedCount: 'Requested',
  authorizedCount: 'Authorized',
  releasedCount: 'Released',
  contractorId: 'Contractor ID',
  contractorName: 'Contractor',
  contractorTenderAmount: 'Contractor tender amount',
  contractorCommit: 'Contractor committed',
  contractorReleased: 'Contractor released',
  contractorCount: 'Contractors',
  projectStartDate: 'Project start date',
  projectEndDate: 'Project deadline',
  requestedAt: 'Requested at',
  authorizedAt: 'Authorized at',
  releasedAt: 'Released at',
  ratio: 'Ratio',
  threshold: 'Threshold',
  share: 'Share',
  reason: 'Indicator',
};

// Evidence keys that hold money and are rendered as ₹ amounts.
const AMOUNT_KEYS = new Set([
  'projectBudget',
  'tenderAmount',
  'milestoneAmount',
  'milestoneTotal',
  'totalMilestoneAmount',
  'paymentAmount',
  'paymentsTotal',
  'releasedTotal',
  'largestPaymentAmount',
  'contractorTenderAmount',
  'contractorCommit',
  'contractorReleased',
]);

const ID_KEYS = new Set(['paymentId', 'milestoneId', 'tenderId', 'contractorId', 'largestPaymentId']);

export function formatMoney(value) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  return `₹${Number(value).toLocaleString('en-IN')}`;
}

export function formatRatio(value) {
  return value === null || value === undefined ? '—' : `×${value}`;
}

export function formatTime(value) {
  return value ? String(value).slice(0, 16).replace('T', ' ') : '—';
}

export function formatEvidenceValue(key, value) {
  if (value === null || value === undefined || value === '') {
    return '—';
  }
  if (AMOUNT_KEYS.has(key)) {
    return formatMoney(value);
  }
  if (key === 'ratio' || key === 'threshold' || key === 'share') {
    return formatRatio(value);
  }
  if (ID_KEYS.has(key)) {
    return `#${value}`;
  }
  if (/At$|Date$|Created$|DueDate$/.test(key)) {
    return formatTime(value);
  }
  if (key === 'reason') {
    return String(value).replace(/_/g, ' ').toLowerCase();
  }
  return String(value);
}


// One risk signal card: rule family, explanation, severity and the exact numbers
// that triggered it (plus any related signals that describe the same fact).
export function RiskSignalCard({ signal }) {
  return (
    <li className="rounded border border-gray-200">
      <div className="flex items-start justify-between gap-3 px-3 py-2 border-b border-gray-100">
        <div>
          <p className="text-xs text-gray-500">
            {CATEGORY_LABELS[signal.category] ? `${CATEGORY_LABELS[signal.category]} · ` : ''}
            {SIGNAL_LABELS[signal.type] || signal.type}
          </p>
          <p className="text-sm text-gray-800">{signal.message}</p>
        </div>
        <span className={`gc-badge ${SEVERITY_TONE[signal.severity] || 'tone-slate'}`}>
          {signal.severity}
        </span>
      </div>
      <div className="px-3 py-2 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
        {Object.entries(signal.evidence || {}).map(([key, value]) => (
          <div key={key} className="flex justify-between gap-3">
            <span className="text-gray-500">{EVIDENCE_LABELS[key] || key}</span>
            <span className="font-medium text-gray-800 text-right">
              {formatEvidenceValue(key, value)}
            </span>
          </div>
        ))}
      </div>
      {signal.relatedSignals && signal.relatedSignals.length > 0 && (
        <div className="px-3 pb-2 text-xs text-gray-500">
          Same fact also detected through:{' '}
          {signal.relatedSignals
            .map((related) => SIGNAL_LABELS[related.type] || related.type)
            .join(', ')}
        </div>
      )}
    </li>
  );
}

// Signal list with the explicit "not confirmed fraud" reminder.
export function RiskSignalList({ signals, emptyTitle = 'No risk indicators', emptyHint }) {
  if (!signals || signals.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="font-semibold text-gray-700">{emptyTitle}</p>
        {emptyHint && <p className="mt-1 text-sm text-gray-500">{emptyHint}</p>}
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {signals.map((signal, index) => (
        <RiskSignalCard key={signal.factKey || `${signal.type}-${index}`} signal={signal} />
      ))}
    </ul>
  );
}

// Risk level + score + severity/category breakdown.
export function RiskScoreBlock({ analysis, compact = false }) {
  const level = analysis.riskLevel;
  const score = analysis.riskScore || 0;
  const breakdown = analysis.scoreBreakdown || {};

  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <p className="gc-eyebrow">Risk level</p>
        <div className="mt-1 flex items-center gap-2">
          <span className={`gc-badge ${LEVEL_TONE[level] || 'tone-slate'}`}>{level}</span>
          <span className="text-sm text-gray-600">
            Risk score <span className="font-semibold">{score}</span> / 100
          </span>
        </div>
        <p className="mt-2 text-sm text-gray-700">{LEVEL_HEADLINE[level] || LEVEL_HEADLINE.LOW}</p>
      </div>
      <div className="min-w-[180px] flex-1">
        <div className="h-2 rounded bg-gray-100 overflow-hidden">
          <div
            className={`h-full ${LEVEL_BAR[level] || 'bg-gray-400'}`}
            style={{ width: `${Math.max(score, 4)}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {breakdown.signals || 0} indicator{breakdown.signals === 1 ? '' : 's'} — HIGH{' '}
          {(breakdown.bySeverity && breakdown.bySeverity.HIGH) || 0} · MEDIUM{' '}
          {(breakdown.bySeverity && breakdown.bySeverity.MEDIUM) || 0} · LOW{' '}
          {(breakdown.bySeverity && breakdown.bySeverity.LOW) || 0}
          {(breakdown.mergedSignals || 0) > 0 && ` · ${breakdown.mergedSignals} merged`}
        </p>
        {!compact && breakdown.byCategory && (
          <p className="mt-1 text-xs text-gray-500">
            {Object.entries(breakdown.byCategory)
              .filter(([, count]) => count > 0)
              .map(([category, count]) => `${CATEGORY_LABELS[category] || category} ${count}`)
              .join(' · ') || 'No signal in any category'}
          </p>
        )}
      </div>
    </div>
  );
}

// Simple label/value grid used by the financial summaries.
export function SummaryGrid({ rows, columns = 2 }) {
  return (
    <div className={`grid gap-x-8 gap-y-2 text-sm ${columns === 2 ? 'sm:grid-cols-2' : ''}`}>
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between gap-3">
          <span className="text-gray-500">{row.label}</span>
          <span className={`text-right ${row.strong ? 'font-semibold' : ''} text-gray-800`}>
            {row.value === null || row.value === undefined ? '—' : row.value}
          </span>
        </div>
      ))}
    </div>
  );
}


