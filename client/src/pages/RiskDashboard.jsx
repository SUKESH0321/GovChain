import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import RiskAlerts from '../components/risk/RiskAlerts';
import { LEVEL_TONE, RiskSignalList } from '../components/RiskSignals';
import CountUp from '../components/ui/CountUp';
import DataTable from '../components/ui/DataTable';
import Drawer from '../components/ui/Drawer';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import LoadingState from '../components/ui/LoadingState';
import StatusBadge from '../components/ui/StatusBadge';
import useRiskDashboard from '../hooks/useRiskDashboard';

const PROJECT_STATUSES = ['PLANNED','IN_PROGRESS','COMPLETED','CANCELLED'];

export default function RiskDashboard() {
  const { summary, disclaimer, items, loading, error, refresh, toggleReviewed } = useRiskDashboard();
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState(null);
  // Default view prioritises projects requiring review: highest score first.
  const [sort, setSort] = useState({ key: 'riskScore', dir: 'desc' });

  const filtered = useMemo(() => {
    let out = items || [];
    if (levelFilter !== 'ALL') out = out.filter(e => e.riskLevel === levelFilter);
    if (statusFilter) out = out.filter(e => e.projectStatus === statusFilter);
    if (sort && sort.key) {
      const { key, dir } = sort;
      out = [...out].sort((a, b) => {
        const av = a[key];
        const bv = b[key];
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        const cmp = typeof av === 'number' && typeof bv === 'number'
          ? av - bv
          : String(av).localeCompare(String(bv));
        return dir === 'asc' ? cmp : -cmp;
      });
    }
    return out;
  }, [items, levelFilter, statusFilter, sort]);

  function toggleSort(key) {
    setSort(cur => (cur && cur.key === key && cur.dir === 'asc'
      ? { key, dir: 'desc' }
      : { key, dir: 'asc' }));
  }

  const done = loading === false && !error && items !== null;

    if (error) return <ErrorState message={error} onRetry={refresh} />;
  if (!done) return <LoadingState rows={6} cols={4} />;

  return (
    <div className="max-w-7xl mx-auto space-y-8">

      <div className="bg-[#0b2140] text-white rounded-2xl shadow-lg p-6 sm:p-10 md:p-12 relative overflow-hidden mb-8 border border-[#1a385f]">
        <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
          {/* Subtle background texture simulated via CSS or could use waves overlay */}
          <div className="w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#38BDF8] via-transparent to-transparent opacity-20 position-absolute" />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start gap-8">
          <div>
            <p className="text-[12px] font-bold text-[#38BDF8] uppercase tracking-[0.2em] mb-3">GovChain Audit & Security</p>
            <h1 className="text-3xl sm:text-4xl md:text-5xl text-white font-black tracking-tight leading-tight">
              AI Risk Intelligence Center
            </h1>
            <p className="mt-5 text-[15px] sm:text-base md:text-lg text-gray-300 max-w-2xl leading-relaxed">
              Real-time monitoring of project anomalies, budget variances, and payment workflows. All signals are calculated directly from immutable blockchain records.
            </p>
          </div>
          <div className="shrink-0">
            <button type="button" onClick={refresh} 
               className="inline-flex items-center justify-center px-6 py-2.5 rounded text-[13px] font-bold bg-white/10 text-white hover:bg-white/20 border border-white/20 shadow-sm transition-colors uppercase tracking-wider">
              Force Deep Rescan
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border-l-[6px] border-l-amber-400 border-t border-r border-b border-gray-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
             <span className="text-2xl" aria-hidden="true">⚠️</span>
          </div>
          <div>
            <p className="text-[13px] font-bold uppercase tracking-widest text-amber-800 mb-1">Advisory Only — Human Review Required</p>
            <p className="text-[15px] text-gray-700 leading-relaxed max-w-5xl">
              {disclaimer ||
                'Risk indicators are generated from project, tender, milestone, payment, and timeline data. They identify unusual patterns that may require human review. A risk indicator is not a determination of fraud or corruption.'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatCard label="Total Projects Analyzed" value={summary?.totalProjects ?? 0} />
        <StatCard label="High Risk Profiles" value={summary?.highRisk ?? 0} tone="tone-red" />
        <StatCard label="Medium Risk Profiles" value={summary?.mediumRisk ?? 0} tone="tone-amber" />
        <StatCard label="Low Risk Profiles" value={summary?.lowRisk ?? 0} tone="tone-green" />
        <StatCard label="Pending Manual Review" value={summary?.requiringReview ?? 0} tone="tone-indigo" />
      </div>

      <div className="pt-4">
        <div className="flex items-center gap-3 mb-5 border-b border-gray-200 pb-3">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
          <h2 className="text-[16px] font-bold uppercase tracking-[0.1em] text-[#0b2140]">Priority Review Queue</h2>
        </div>
        <RiskAlerts items={items} />
      </div>

      <div className="flex flex-wrap gap-5 items-center bg-white p-5 rounded-xl border border-gray-200 shadow-sm mt-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[12px] font-bold text-gray-500 uppercase tracking-widest shrink-0">Risk Priority:</span>
          <div className="flex flex-wrap gap-2">
            {['ALL','HIGH','MEDIUM','LOW'].map(level => (
              <button key={level} type='button' onClick={() => setLevelFilter(level)}
                className={`px-4 py-2 rounded text-[13px] font-bold uppercase tracking-wider transition-all border
                   ${levelFilter === level 
                      ? 'bg-[#0057D9] text-white border-[#0057D9] shadow-sm' 
                      : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50 hover:border-gray-300'}`}>
                {level === 'ALL' ? 'All Alerts' : level}
              </button>
            ))}
          </div>
        </div>
        
        <div className="w-px h-8 bg-gray-200 hidden lg:block"></div>
        
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[12px] font-bold text-gray-500 uppercase tracking-widest shrink-0">Stage:</span>
          <select className='appearance-none bg-white border border-gray-200 text-gray-700 py-2 pl-4 pr-8 rounded text-[14px] font-semibold tracking-wide hover:border-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-[#0057D9]/20 focus:border-[#0057D9] shadow-sm' 
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)} style={{ width: 'auto' }}>
            <option value=''>ALL STATUSES</option>
            {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
          </select>
        </div>
        
        <span className="text-[12px] font-bold text-gray-500 ml-auto uppercase tracking-wider bg-gray-100 px-3 py-1.5 rounded-full">{filtered.length} of {items.length} shown</span>
      </div>

      <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden mt-6">
        <div className="px-6 py-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
          <div>
            <h2 className="text-[18px] font-bold text-[#0b2140]">Active Intelligence Register</h2>
            <p className="text-[14px] text-gray-500 mt-1">Select any project row to view its full analytical breakdown.</p>
          </div>
        </div>
        <div className="p-0">
          <DataTable
            columns={[
              { key: 'projectName', label: 'Project Entity', sortable: true },
              { key: 'projectId', label: 'ID', align: 'right' },
              { key: 'riskLevel', label: 'Threat Level', align: 'center', sortable: true,
                render: row => <span className={`px-2 py-0.5 rounded text-[11px] font-bold tracking-wider uppercase border
               ${row.riskLevel === 'HIGH' ? 'bg-red-50 text-red-700 border-red-200' 
                 : row.riskLevel === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border-amber-200' 
                 : 'bg-green-50 text-green-700 border-green-200'}`}>{row.riskLevel}</span> },
              { key: 'riskScore', label: 'Score', align: 'right', sortable: true, 
                render: row => <span className="font-bold">{row.riskScore ?? '-'}</span> },
              { key: 'signalCount', label: 'Anomalies', align: 'right', sortable: true,
                render: row => <span className="font-medium text-gray-600">{row.signalCount}</span> },
              { key: 'projectStatus', label: 'Stage', align: 'center', render: row => <StatusBadge status={row.projectStatus} /> },
              { key: 'reviewed', label: 'Audit Status', align: 'center',
                render: row => row.reviewed
                  ? <span className='text-[13px] text-green-600 font-bold uppercase tracking-wider'>Reviewed</span>
                  : <span className='text-[13px] text-amber-600 font-bold uppercase tracking-wider'>Action Req</span> },
            ]}
            rows={filtered}
            sort={sort}
            onSort={toggleSort}
            onRowClick={row => setSelected(row)}
            empty={<EmptyState title='No intelligence records available.'
              hint='No projects match the current filter parameters, or telemetry has not been indexed.' />}
          />
        </div>
      </div>

      <Drawer open={!!selected} onClose={() => setSelected(null)}
        title={selected ? "Project Intelligence Report" : ''} width='920px'>
        {selected && (
          <div className='space-y-8 pb-10 mt-2'>
            
            {/* Header Status Bar */}
            <div className='flex items-center justify-between gap-6 flex-wrap bg-slate-50 p-6 rounded-xl border border-slate-200'>
              <div className='flex items-center gap-5'>
                <span className={`px-4 py-1.5 rounded-md text-[14px] font-bold tracking-wider uppercase border shadow-sm
                  ${selected.riskLevel === 'HIGH' ? 'bg-red-50 text-red-700 border-red-200' 
                   : selected.riskLevel === 'MEDIUM' ? 'bg-amber-50 text-amber-700 border-amber-200' 
                   : 'bg-green-50 text-green-700 border-green-200'}`}>
                  {selected.riskLevel} RISK
                </span>
                <span className='text-[14px] font-bold text-gray-500 uppercase tracking-widest border-l border-gray-300 pl-5'>
                   Intelligence Score <span className={`text-[24px] ml-1.5 ${selected.riskLevel === 'HIGH' ? 'text-red-700' : 'text-gray-900'}`}>{selected.riskScore}</span><span className="text-gray-400">/100</span>
                </span>
              </div>
              <div className='flex items-center gap-4'>
                <StatusBadge status={selected.projectStatus} />
                <button type='button' onClick={() => toggleReviewed(selected.projectId)}
                  className={`px-5 py-2.5 rounded text-[13px] font-bold uppercase tracking-wider transition-colors border
                    ${selected.reviewed ? 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50' : 'bg-[#fff5e6] text-[#b97a00] border-[#f5b800] hover:bg-[#ffeec2] shadow-sm'}`}>
                  {selected.reviewed ? 'Re-open Investigation' : 'Mark as Reviewed'}
                </button>
              </div>
            </div>

            {/* Financial Overview */}
            <div>
              <p className='text-[12px] font-bold uppercase tracking-[0.2em] text-gray-400 border-b border-gray-100 pb-2 mb-4'>Financial Summary</p>
              <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4'>
                 <div className='bg-white border text-gray-800 border-gray-200 rounded-lg p-5 shadow-sm flex flex-col'>
                    <span className='text-[12px] font-bold uppercase text-gray-500 tracking-wider mb-2'>Allocated Budget</span>
                    <span className='text-[22px] font-bold text-[#0b2140]'>
                      {selected.projectBudget ? '₹' + Number(selected.projectBudget).toLocaleString('en-IN') : 'Unassigned'}
                    </span>
                 </div>
              </div>
            </div>

            {/* Signals */}
            <div>
              <p className='text-[12px] font-bold uppercase tracking-[0.2em] text-gray-400 border-b border-gray-100 pb-2 mb-4'>Detected Anomalies</p>
              {selected.signals && selected.signals.length > 0 ? (
                <RiskSignalList signals={selected.signals} emptyTitle='No risk indicators'
                  emptyHint='No anomaly rules matched the current records.' />
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center mt-4">
                   <p className="text-green-800 text-lg font-bold mb-2">No anomalies detected</p>
                   <p className='text-sm text-green-700/80 max-w-md mx-auto'>Extracted telemetry shows standard nominal behavior. Financial parameters are within acceptable thresholds.</p>
                </div>
              )}
            </div>

            {/* Footer action */}
            <div className='pt-6 mt-4 border-t border-gray-200 flex flex-col sm:flex-row gap-5 sm:items-center justify-between'>
              <Link to={'/projects/' + selected.projectId} 
                className='inline-flex items-center justify-center px-8 py-3.5 rounded text-[15px] font-bold bg-[#0057D9] text-white hover:bg-[#0042a6] border border-[#0057D9] shadow-md transition-colors w-full sm:w-auto text-center'>
                Proceed to Deep Analysis Console
              </Link>
              <p className='text-[13px] text-gray-500 max-w-sm leading-relaxed sm:text-right hidden md:block'>
                Access the complete ledger immutable audit trail and individual milestone records.
              </p>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

function StatCard({ label, value, tone = 'tone-slate' }) {
  const isHigh = tone.includes('red');
  const isMedium = tone.includes('amber');
  const isLow = tone.includes('green');
  const isReview = tone.includes('indigo');

  let ringColor = 'border-slate-200';
  let bgColor = 'bg-white';
  let numColor = 'text-[#0b2140]';
  
  if (isHigh) { ringColor = 'border-red-200'; bgColor = 'bg-red-50/50'; numColor = 'text-red-700'; }
  else if (isMedium) { ringColor = 'border-amber-200'; bgColor = 'bg-amber-50/50'; numColor = 'text-amber-700'; }
  else if (isLow) { ringColor = 'border-green-200'; bgColor = 'bg-green-50/50'; numColor = 'text-green-700'; }
  else if (isReview) { ringColor = 'border-[#0057D9]/20'; bgColor = 'bg-[#f5f8fc]'; numColor = 'text-[#0057D9]'; }

  return (
    <div className={`p-5 rounded-xl border shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 ${ringColor} ${bgColor} flex flex-col justify-between min-h-[140px]`}>
      <p className="text-[12px] font-bold text-slate-500 uppercase tracking-widest mb-3 leading-tight">{label}</p>
      <p className={`text-4xl sm:text-5xl font-black tracking-tight ${numColor}`}>
        <CountUp value={value} />
      </p>
    </div>
  );
}
