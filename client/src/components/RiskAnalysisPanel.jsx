import EmptyState from './ui/EmptyState';
import ErrorState from './ui/ErrorState';
import LoadingState from './ui/LoadingState';
import {
  RiskScoreBlock,
  RiskSignalList,
  SummaryGrid,
  formatMoney,
  formatRatio,
} from './RiskSignals';

// GovChain — Stage 4.1 / Stage 4.2 · AI risk & anomaly panel.
//
// Read-only view of the deterministic analysis calculated by
// server/services/risk.service.js from the existing GovChain records: the
// financial summary of the project, the cross-entity risk signals (project,
// tender, milestone, payment, timeline, contractor) and the scoring breakdown.
//
// The wording is deliberate: these are *risk indicators that require review*.
// Nothing here states or implies that fraud, corruption or a crime was proven.

// Financial summary of the project, straight from analysis.summary.
function ProjectFinancialSummary({ summary }) {
  const rows = [
    { label: 'Project budget', value: formatMoney(summary.projectBudget), strong: true },
    {
      label: `Tender amount${summary.tenderCount > 1 ? ` (${summary.tenderCount} tenders)` : ''}`,
      value:
        summary.tenderAmount === null ? 'No tender recorded' : formatMoney(summary.tenderAmount),
    },
    {
      label: `Milestone allocation${summary.milestoneCount ? ` (${summary.milestoneCount})` : ''}`,
      value: formatMoney(summary.totalMilestoneAmount),
    },
    { label: 'Requested payments', value: formatMoney(summary.totalRequestedPayments) },
    { label: 'Authorized payments', value: formatMoney(summary.totalAuthorizedPayments) },
    { label: 'Released payments', value: formatMoney(summary.totalReleasedPayments) },
    { label: 'Rejected payments (not an outflow)', value: formatMoney(summary.totalRejectedPayments) },
    {
      label: 'Remaining budget (after committed)',
      value: formatMoney(summary.remainingProjectBudget),
      strong: true,
    },
    { label: 'Allocation vs budget', value: formatRatio(summary.allocationAgainstBudget) },
    { label: 'Committed vs tender', value: formatRatio(summary.paymentsAgainstTender) },
  ];

  return (
    <div className="space-y-3">
      <SummaryGrid rows={rows} />

      {summary.contractors && summary.contractors.length > 0 && (
        <div className="pt-1">
          <p className="text-xs font-semibold text-gray-600 mb-1">Payment concentration</p>
          <ul className="space-y-1 text-xs">
            {summary.contractors.map((contractor) => (
              <li
                key={contractor.contractorId}
                className="flex flex-wrap justify-between gap-2 text-gray-700"
              >
                <span>
                  #{contractor.contractorId} {contractor.contractorName || 'Contractor'}
                </span>
                <span className="text-gray-500">
                  committed {formatMoney(contractor.committed)} · released{' '}
                  {formatMoney(contractor.released)} · share of payments{' '}
                  {formatRatio(contractor.shareOfPayments)}
                  {contractor.shareOfBudget !== null &&
                    ` · of budget ${formatRatio(contractor.shareOfBudget)}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-gray-500">
        Figures are read from the project, tender, milestone and payment records. Authorized and
        released amounts cover each payment once; rejected payments are never counted as an outflow.
      </p>
    </div>
  );
}


export default function RiskAnalysisPanel({
  analysis,
  loading = false,
  error = null,
  onRetry,
  title = 'AI risk analysis',
}) {
  if (loading) {
    return (
      <div className="gc-panel gc-animate-entrance">
        <div className="gc-panel-head">
          <span className="font-semibold">{title}</span>
          <span className="text-xs text-gray-500">calculating from the current records…</span>
        </div>
        <div className="gc-panel-body">
          <LoadingState rows={4} cols={3} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="gc-panel gc-animate-entrance">
        <div className="gc-panel-head">
          <span className="font-semibold">{title}</span>
        </div>
        <div className="gc-panel-body">
          <ErrorState message={error} onRetry={onRetry} />
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="gc-panel gc-animate-entrance">
        <div className="gc-panel-head">
          <span className="font-semibold">{title}</span>
        </div>
        <div className="gc-panel-body">
          <EmptyState
            title="No analysis yet"
            hint="Open this tab to calculate the risk indicators from the current project records."
          />
        </div>
      </div>
    );
  }

  const signals = analysis.signals || [];
  const breakdown = analysis.scoreBreakdown || {};
  const analyzed = analysis.analyzed || {};
  const suppressed = breakdown.suppressed || [];

  return (
    <div className="gc-panel gc-animate-entrance gc-stagger-1">
      <div className="gc-panel-head">
        <span className="font-semibold">{title}</span>
        <span className="text-xs text-gray-500">
          deterministic rule engine · calculated on request · nothing stored
        </span>
      </div>

      <div className="gc-panel-body space-y-5">
        <RiskScoreBlock analysis={analysis} />

        {analysis.summary && (
          <div className="rounded border border-gray-200">
            <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
              <span className="text-sm font-semibold text-gray-800">Financial summary</span>
              <span className="text-xs text-gray-500">read from the current records</span>
            </div>
            <div className="px-3 py-2">
              <ProjectFinancialSummary summary={analysis.summary} />
            </div>
          </div>
        )}

        {/* Explicit AI-signal vs confirmed-fraud distinction */}
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs font-semibold text-amber-800">
            AI risk signal — not confirmed fraud.
          </p>
          <p className="mt-0.5 text-xs text-amber-700">
            {analysis.disclaimer ||
              'Automated indicators derived from the GovChain records. A flagged signal is a potential anomaly that requires review.'}
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold text-gray-800 mb-2">Detected risk signals</p>
          <RiskSignalList
            signals={signals}
            emptyTitle="No risk indicators"
            emptyHint="The current project, tender, milestone and payment records do not match any configured anomaly rule."
          />
        </div>

        <hr className="gc-divider" />

        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-xs text-gray-500">
          <p>
            Analysed: {analyzed.tenders || 0} tender{analyzed.tenders === 1 ? '' : 's'} ·{' '}
            {analyzed.milestones || 0} milestone{analyzed.milestones === 1 ? '' : 's'} ·{' '}
            {analyzed.payments || 0} payment{analyzed.payments === 1 ? '' : 's'}
            {(breakdown.mergedSignals || 0) > 0 && ` · ${breakdown.mergedSignals} signal(s) merged`}
          </p>
          <p>
            Score = sum of the severity weights (HIGH 40 · MEDIUM 20 · LOW 8), capped at 100; level
            cut-offs {breakdown.levels ? breakdown.levels.mediumScore : 20}/
            {breakdown.levels ? breakdown.levels.highScore : 60}. Signals describing the same fact are
            scored once, so the same records always produce the same score.
          </p>
          {suppressed.length > 0 && (
            <p>
              Comparisons skipped to avoid double counting: {suppressed.map((s) => s.rule).join(', ')}.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
