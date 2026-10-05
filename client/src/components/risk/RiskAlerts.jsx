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
    <ul className="space-y-4 max-w-7xl">
      {alerts.map(({ entry, signal }) => (
        <li key={entry.projectId} className="relative bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md hover:border-[#38BDF8]">
          <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gray-300" 
               style={{ backgroundColor: signal.severity === 'HIGH' ? 'var(--gc-red)' : signal.severity === 'MEDIUM' ? 'var(--gc-amber)' : 'var(--gc-green)' }} 
          />
          
          <div className="px-5 sm:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6 pl-8">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-2.5">
                <span className={`px-2 py-0.5 rounded text-[12px] font-bold tracking-wider uppercase border
                   ${signal.severity === 'HIGH' ? 'bg-red-50 text-red-700 border-red-200' 
                     : signal.severity === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border-amber-200' 
                     : 'bg-green-50 text-green-700 border-green-200'}`}>
                  {signal.severity} SIGNAL
                </span>
                <span className="text-[12px] font-bold uppercase tracking-widest text-[#0057D9]">
                  Score {entry.riskScore}/100
                </span>
                {entry.reviewed ? (
                  <span className="text-[12px] font-bold uppercase tracking-widest text-green-600 pl-3 border-l border-gray-200">
                    Reviewed
                  </span>
                ) : (
                  <span className="text-[12px] font-bold uppercase tracking-widest text-amber-600 pl-3 border-l border-gray-200">
                    Review Required
                  </span>
                )}
              </div>
              
              <h3 className="text-xl font-bold text-[#0b2140] truncate max-w-full">
                {entry.projectName}
                <span className="ml-3 text-[14px] font-medium text-gray-500 tracking-wide">ID: #{entry.projectId}</span>
              </h3>
              <p className="mt-2 text-[15px] sm:text-base text-gray-700 leading-relaxed max-w-4xl">
                {signal.message}
              </p>
            </div>
            
            <div className="shrink-0 flex items-center md:flex-col md:items-end gap-3 justify-between pt-3 md:pt-0 border-t border-gray-100 md:border-0 mt-2 md:mt-0">
              <p className="text-[13px] md:text-sm font-semibold text-gray-500 md:text-right w-full bg-slate-50 px-3 py-1.5 rounded-md border border-slate-100">
                {entry.signalCount} anomaly indicator{entry.signalCount === 1 ? '' : 's'} total
              </p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
