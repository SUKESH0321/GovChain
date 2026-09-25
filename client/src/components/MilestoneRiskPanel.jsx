import { useCallback, useEffect, useState } from 'react';

import { getMilestoneRiskAnalysis } from '../services/risk.service';
import ErrorState from './ui/ErrorState';
import LoadingState from './ui/LoadingState';
import {
  RiskScoreBlock,
  RiskSignalList,
  SummaryGrid,
  formatMoney,
  formatRatio,
  formatTime,
} from './RiskSignals';

// GovChain — Stage 4.2 · milestone risk section.
//
// Shown inside an expanded milestone (see MilestoneTimeline). It loads the
// focused analysis from GET /api/milestones/:id/risk-analysis on demand, so the
// engine only runs when a user actually looks at the milestone. Everything it
// renders comes from that response — no client-side calculation and no invented
// value. Wording stays at "risk indicator / requires review".
export default function MilestoneRiskPanel({ milestoneId }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!milestoneId) {
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError(null);

    getMilestoneRiskAnalysis(milestoneId)
      .then((data) => {
        if (!active) {
          return;
        }
        setAnalysis(data.milestoneAnalysis);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) {
          return;
        }
        setAnalysis(null);
        setError(err.message);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [milestoneId, reloadKey]);

  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  if (loading) {
    return (
      <div className="mt-3">
        <p className="text-xs text-gray-500 mb-2">Calculating milestone risk…</p>
        <LoadingState rows={3} cols={2} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-3">
        <p className="text-xs text-gray-500 mb-2">Milestone risk</p>
        <ErrorState message={error} onRetry={retry} />
      </div>
    );
  }

  if (!analysis) {
    return null;
  }

  const summary = analysis.summary || {};
  const rows = [
    { label: 'Milestone amount', value: formatMoney(summary.milestoneAmount), strong: true },
    { label: 'Status', value: summary.milestoneStatus || '—' },
    { label: 'Payment records', value: summary.paymentCount || 0 },
    { label: 'Payment total (active statuses)', value: formatMoney(summary.paymentsTotal) },
    { label: 'Requested', value: formatMoney(summary.totalRequestedPayments) },
    { label: 'Authorized', value: formatMoney(summary.totalAuthorizedPayments) },
    { label: 'Released', value: formatMoney(summary.totalReleasedPayments) },
    { label: 'Released vs milestone', value: formatRatio(summary.releasedAgainstMilestone) },
    { label: 'Due date', value: summary.dueDate ? formatTime(summary.dueDate) : '—' },
    { label: 'First requested', value: summary.firstRequestedAt ? formatTime(summary.firstRequestedAt) : '—' },
    { label: 'Last released', value: summary.lastReleasedAt ? formatTime(summary.lastReleasedAt) : '—' },
  ];

  return (
    <div className="mt-3 rounded border border-gray-200">
      <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
        <span className="text-sm font-semibold text-gray-800">Milestone risk</span>
        <span className="text-xs text-gray-500">
          calculated on request · project context: {analysis.projectRiskLevel} ({analysis.projectRiskScore}/100)
        </span>
      </div>

      <div className="px-3 py-3 space-y-3">
        <RiskScoreBlock analysis={analysis} compact />
        <SummaryGrid rows={rows} />

        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2">
          <p className="text-xs text-amber-800">
            Risk indicator — requires review. Not confirmed fraud or corruption.
          </p>
        </div>

        <RiskSignalList
          signals={analysis.signals}
          emptyTitle="No milestone risk indicators"
          emptyHint="The milestone's amount, status, timeline and payments do not match any configured anomaly rule."
        />
      </div>
    </div>
  );
}
