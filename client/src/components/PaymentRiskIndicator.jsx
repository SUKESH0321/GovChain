import { useEffect, useState } from 'react';

import { getProjectRiskAnalysis } from '../services/risk.service';
import { LEVEL_TONE } from './RiskSignals';

// GovChain — Stage 4.3 · payment risk indicator.
//
// Advisory only: it reuses the existing Stage 4.2 project analysis
// (GET /api/projects/:id/risk-analysis) and shows only the signals that
// reference this payment (evidence.paymentId). It never blocks, authorizes or
// releases a payment — the human workflow in the dashboard stays authoritative.
export default function PaymentRiskIndicator({ payment }) {
  const [state, setState] = useState({ loading: true, signals: null, error: null });

  useEffect(() => {
    if (!payment) {
      return undefined;
    }
    let active = true;
    setState({ loading: true, signals: null, error: null });

    getProjectRiskAnalysis(payment.project_id)
      .then((data) => {
        if (!active) {
          return;
        }
        const signals = (data.riskAnalysis.signals || []).filter(
          (signal) => signal.evidence && signal.evidence.paymentId === payment.id
        );
        setState({ loading: false, signals, error: null });
      })
      .catch((err) => {
        if (!active) {
          return;
        }
        setState({ loading: false, signals: null, error: err.message });
      });

    return () => {
      active = false;
    };
  }, [payment && payment.id, payment && payment.project_id]);

  if (state.loading) {
    return <p className="text-xs text-gray-500">Checking payment risk indicators…</p>;
  }

  if (state.error) {
    return null;
  }

  if (!state.signals || state.signals.length === 0) {
    return (
      <p className="text-xs text-gray-500">
        No payment risk indicators for this payment in the current records.
      </p>
    );
  }

  const top = state.signals[0];

  return (
    <div className="rounded border border-gray-200 px-3 py-2">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="text-sm font-semibold text-gray-800">Risk indicator</span>
        <span className={`gc-badge ${LEVEL_TONE[top.severity] || 'tone-slate'}`}>
          {top.severity}
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-600">{top.message}</p>
      {state.signals.length > 1 && (
        <p className="mt-0.5 text-xs text-gray-500">
          + {state.signals.length - 1} further indicator{state.signals.length - 1 === 1 ? '' : 's'}{' '}
          for this payment — see the project risk analysis.
        </p>
      )}
      <p className="mt-1 text-xs text-gray-500">
        Advisory only — requires human review and never blocks a payment.
      </p>
    </div>
  );
}
