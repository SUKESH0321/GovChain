import { LEVEL_TONE } from '../RiskSignals';

// GovChain — Stage 4.3 · in-application risk alerts.
//
// Every alert is generated from an actual risk signal of the dashboard summary:
// one alert per project that has signals, headlined by its highest-severity
// signal. No emails, SMS, push notifications or fabricated alerts — this is the
// in-app presentation of what the Stage 4.1/4.2 engine already calculated.
const LEVEL_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export default function RiskAlerts({ items }) {
  const alerts = (items || [])
    .filter((entry) => entry.signalCount > 0 && entry.signals && entry.signals.length > 0)
    .map((entry) => ({ entry, signal: entry.signals[0] }))
    .sort((a, b) => {
      const levelDiff =
        (LEVEL_ORDER[a.signal.severity] ?? 3) - (LEVEL_ORDER[b.signal.severity] ?? 3);
      if (levelDiff !== 0) {
        return levelDiff;
      }
      return (b.entry.riskScore || 0) - (a.entry.riskScore || 0);
    });

  if (alerts.length === 0) {
    return <p className="text-sm text-gray-500">No current risk indicators require review.</p>;
  }

  return (
    <ul className="space-y-3">
      {alerts.map(({ entry, signal }) => (
        <li key={entry.projectId} className="rounded border border-gray-200 px-3 py-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-800">
                {entry.projectName}{' '}
                <span className="font-normal text-gray-500">· Record #{entry.projectId}</span>
              </p>
              <p className="mt-0.5 text-sm text-gray-600">{signal.message}</p>
            </div>
            <span className={`gc-badge ${LEVEL_TONE[signal.severity] || 'tone-slate'} shrink-0`}>
              {signal.severity}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            Project risk {entry.riskLevel} · score {entry.riskScore}/100 · {entry.signalCount}{' '}
            indicator{entry.signalCount === 1 ? '' : 's'}
            {entry.reviewed ? ' · Reviewed' : ' · Requires review'}
          </p>
        </li>
      ))}
    </ul>
  );
}
