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
export function RiskSignalCard({ signal }) {
  return (
    <li className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm transition-all hover:shadow-md">
      <div className={`h-1 w-full ${LEVEL_BAR[signal.severity] || 'bg-gray-300'}`} />
      
      <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/80 flex items-start justify-between gap-4">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-widest text-gray-500 mb-1">
            {CATEGORY_LABELS[signal.category] ? `${CATEGORY_LABELS[signal.category]} INDICATOR` : 'RISK INDICATOR'}
          </p>
          <span className={`px-2.5 py-0.5 rounded text-[12px] font-bold tracking-wider uppercase border
               ${signal.severity === 'HIGH' ? 'bg-red-50 text-red-700 border-red-200' 
                 : signal.severity === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border-amber-200' 
                 : 'bg-green-50 text-green-700 border-green-200'}`}>
            {signal.severity}
          </span>
        </div>
      </div>
      
      <div className="px-5 py-5">
        <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-2">{SIGNAL_LABELS[signal.type] || signal.type}</h3>
        <p className="text-[15px] text-gray-700 leading-relaxed mb-5 max-w-3xl">{signal.message}</p>
        
        {signal.evidence && Object.keys(signal.evidence).length > 0 && (
          <div className="bg-slate-50/50 rounded-md border border-slate-200 p-4">
            <h4 className="text-[12px] font-bold text-slate-500 uppercase tracking-widest mb-3">Supporting Evidence Data</h4>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4">
              {Object.entries(signal.evidence).map(([key, value]) => (
                <div key={key} className="flex flex-col sm:flex-row justify-between sm:items-center gap-1 sm:gap-3 pb-2 border-b border-gray-100 last:border-0 last:pb-0 sm:[&:nth-last-child(-n+2)]:border-0 sm:[&:nth-last-child(-n+2)]:pb-0 lg:[&:nth-last-child(-n+3)]:border-0 lg:[&:nth-last-child(-n+3)]:pb-0">
                  <span className="text-[14px] text-gray-500 font-medium">{EVIDENCE_LABELS[key] || key}</span>
                  <span className="text-[14px] font-semibold text-gray-900">
                    {formatEvidenceValue(key, value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {signal.relatedSignals && signal.relatedSignals.length > 0 && (
        <div className="px-5 py-3 bg-gray-50/50 border-t border-gray-100 text-[13px] text-gray-500 flex flex-wrap gap-2 items-center">
          <span className="font-semibold text-gray-600">Cross-verified via:</span>
          {signal.relatedSignals.map((related, i) => (
             <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600 font-medium">
               {SIGNAL_LABELS[related.type] || related.type}
             </span>
          ))}
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

export function RiskScoreBlock({ analysis, compact = false }) {
  const level = analysis.riskLevel;
  const score = analysis.riskScore || 0;
  const breakdown = analysis.scoreBreakdown || {};

  return (
    <div className={`flex flex-col md:flex-row md:items-center justify-between gap-6 p-5 sm:p-6 bg-white rounded-xl border border-gray-200 shadow-sm ${compact ? 'md:flex-col items-start' : ''}`}>
      
      {/* Left side: Gauge & Core Info */}
      <div className="flex items-center gap-6">
        <div className="relative shrink-0 flex items-center justify-center w-24 h-24 rounded-full border-[5px] border-gray-100 bg-gray-50 shadow-inner">
          <div className="text-center mt-1">
            <span className={`block text-[28px] leading-tight font-black ${level === 'HIGH' ? 'text-red-700' : level === 'MEDIUM' ? 'text-amber-600' : 'text-green-600'}`}>
              {score}
            </span>
            <span className="text-[12px] font-bold text-gray-500 uppercase tracking-widest relative -top-1">Score</span>
          </div>
          <svg className="absolute inset-0 w-full h-full transform -rotate-90 pointer-events-none" viewBox="0 0 100 100">
             <circle cx="50" cy="50" r="45" fill="transparent" stroke="currentColor" strokeWidth="10" 
               className={`${level === 'HIGH' ? 'text-red-500' : level === 'MEDIUM' ? 'text-amber-400' : 'text-green-400'}`}
               strokeDasharray="283" strokeDashoffset={283 - (283 * score) / 100} strokeLinecap="round" />
          </svg>
        </div>

        <div className="flex-1">
          <p className="text-[12px] font-bold uppercase tracking-[0.15em] text-gray-500 mb-2">Overall Assessment</p>
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <span className={`px-2.5 py-0.5 rounded text-[13px] font-bold tracking-wider uppercase border shadow-sm
               ${level === 'HIGH' ? 'bg-red-50 text-red-700 border-red-200' 
                 : level === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border-amber-200' 
                 : 'bg-green-50 text-green-700 border-green-200'}`}>
              {level} RISK
            </span>
          </div>
          <p className="text-[14px] font-medium text-gray-800 leading-snug max-w-xs">
            {LEVEL_HEADLINE[level] || LEVEL_HEADLINE.LOW}
          </p>
        </div>
      </div>

      {/* Right side: Detailed Breakdown */}
      <div className={`w-full ${compact ? 'md:w-full' : 'md:max-w-xs xl:max-w-sm'} shrink-0 bg-slate-50/80 rounded-lg border border-slate-200 p-4`}>
        <h4 className="text-[12px] font-bold text-slate-500 uppercase tracking-widest mb-3">Signal Breakdown</h4>
        <div className="grid grid-cols-3 gap-3 text-center divide-x divide-slate-200/60 transition-all">
          <div>
            <span className="block text-[22px] font-bold text-red-600">{(breakdown.bySeverity && breakdown.bySeverity.HIGH) || 0}</span>
            <span className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">High</span>
          </div>
          <div>
            <span className="block text-[22px] font-bold text-amber-600">{(breakdown.bySeverity && breakdown.bySeverity.MEDIUM) || 0}</span>
            <span className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">Medium</span>
          </div>
          <div>
            <span className="block text-[22px] font-bold text-green-600">{(breakdown.bySeverity && breakdown.bySeverity.LOW) || 0}</span>
            <span className="text-[12px] font-bold text-slate-500 uppercase tracking-wider">Low</span>
          </div>
        </div>
        {!compact && breakdown.byCategory && (
          <div className="mt-4 pt-3 border-t border-slate-200/70 text-center px-2">
             <p className="text-[12px] font-medium text-slate-600 leading-tight">
               {Object.entries(breakdown.byCategory)
                 .filter(([, count]) => count > 0)
                 .map(([category, count]) => `${CATEGORY_LABELS[category] || category} (${count})`)
                 .join(' · ') || 'No signals detected'}
             </p>
          </div>
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


