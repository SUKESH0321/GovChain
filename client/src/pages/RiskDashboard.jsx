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
    <div className="max-w-6xl mx-auto space-y-6">

      <div className="gc-hero gc-hero--compact">
        <div className="gc-waves-overlay" />
        <div className="gc-hero-body">
          <div>
            <p className="gc-eyebrow">AI Risk Dashboard</p>
            <h1 className="text-2xl mt-1" style={{ fontFamily: "var(--gc-font-display)", color: "var(--gc-navy)" }}>
              Risk Overview
            </h1>
          </div>
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={refresh} className="gc-btn gc-btn-outline gc-btn-sm">Refresh</button>
          </div>
        </div>
      </div>

      <div className="rounded border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-xs font-semibold text-amber-800">AI risk analysis - advisory only</p>
        <p className="mt-1 text-sm text-amber-700">
          {disclaimer ||
            'Risk indicators are generated from project, tender, milestone, payment, and timeline data. They identify unusual patterns that may require human review. A risk indicator is not a determination of fraud or corruption.'}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <StatCard label="Total Projects Analyzed" value={summary?.totalProjects ?? 0} />
        <StatCard label="High Risk" value={summary?.highRisk ?? 0} tone="tone-red" />
        <StatCard label="Medium Risk" value={summary?.mediumRisk ?? 0} tone="tone-amber" />
        <StatCard label="Low Risk" value={summary?.lowRisk ?? 0} tone="tone-green" />
        <StatCard label="Projects Requiring Review" value={summary?.requiringReview ?? 0} tone="tone-indigo" />
      </div>

      <div>
        <p className="gc-eyebrow text-gray-500">Risk Alerts</p>
        <RiskAlerts items={items} />
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <span className="text-sm text-gray-500">Risk level:</span>
        {['ALL','HIGH','MEDIUM','LOW'].map(level => (
          <button key={level} type='button' onClick={() => setLevelFilter(level)}
            className={`gc-badge shrink-0 cursor-pointer transition ${levelFilter === level ? LEVEL_TONE[level] || 'tone-slate' : 'tone-slate/60 hover:tone-slate'}`}>
            {level === 'ALL' ? 'All' : level}
          </button>
        ))}
        <span className="text-sm text-gray-500 ml-1">Status:</span>
        <select className='gc-select text-sm' value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)} style={{ width: 'auto' }}>
          <option value=''>All statuses</option>
          {PROJECT_STATUSES.map(s => <option key={s} value={s}>{s.replace('_',' ')}</option>)}
        </select>
        <span className="text-sm text-gray-500 ml-auto">{filtered.length} of {items.length} shown</span>
      </div>

      <div className="gc-panel gc-animate-entrance gc-stagger-1">
        <div className="gc-panel-head">
          <span className="font-semibold">Project Risk</span>
          <span className="text-xs text-gray-500">Click a row for detail</span>
        </div>
        <div className="gc-panel-body">
          <DataTable
            columns={[
              { key: 'projectName', label: 'Project', sortable: true },
              { key: 'projectId', label: 'ID', align: 'right' },
              { key: 'riskLevel', label: 'Risk', align: 'center', sortable: true,
                render: row => <span className={`gc-badge ${LEVEL_TONE[row.riskLevel] || 'tone-slate'}`}>{row.riskLevel}</span> },
              { key: 'riskScore', label: 'Score', align: 'right', sortable: true, render: row => row.riskScore ?? '-' },
              { key: 'signalCount', label: 'Signals', align: 'right', sortable: true },
              { key: 'projectStatus', label: 'Status', align: 'center', render: row => <StatusBadge status={row.projectStatus} /> },
              { key: 'reviewed', label: 'Review', align: 'center',
                render: row => row.reviewed
                  ? <span className='text-xs text-green-600 font-medium'>Reviewed</span>
                  : <span className='text-xs text-amber-600 font-medium'>Requires review</span> },
            ]}
            rows={filtered}
            sort={sort}
            onSort={toggleSort}
            onRowClick={row => setSelected(row)}
            empty={<EmptyState title='No project risk data available.'
              hint='No projects match the current filter, or no risk analysis has been calculated yet.' />}
          />
        </div>
      </div>

      <Drawer open={!!selected} onClose={() => setSelected(null)}
        title={selected ? selected.projectName : ''} width='560px'>
        {selected && (
          <div className='space-y-5'>
            <div className='flex items-center justify-between gap-3 flex-wrap'>
              <div className='flex items-center gap-2'>
                <span className={`gc-badge ${LEVEL_TONE[selected.riskLevel] || 'tone-slate'}`}>{selected.riskLevel}</span>
                <span className='text-sm text-gray-600'>Score {selected.riskScore}/100</span>
              </div>
              <div className='flex items-center gap-2'>
                <StatusBadge status={selected.projectStatus} />
                <button type='button' onClick={() => toggleReviewed(selected.projectId)}
                  className='gc-btn gc-btn-outline gc-btn-sm'>
                  {selected.reviewed ? 'Mark un-reviewed' : 'Mark reviewed'}
                </button>
              </div>
            </div>
            <div>
              <p className='gc-eyebrow mb-2'>Financial summary</p>
              <div className='grid grid-cols-2 gap-x-6 gap-y-2 text-sm'>
                <div className='flex justify-between'>
                  <span className='text-gray-500'>Project budget</span>
                  <span className='text-gray-800 font-medium'>
                    {selected.projectBudget ? '₹' + Number(selected.projectBudget).toLocaleString('en-IN') : '-'}
                  </span>
                </div>
              </div>
            </div>
            <div>
              <p className='gc-eyebrow mb-2'>Risk signals</p>
              {selected.signals && selected.signals.length > 0 ? (
                <RiskSignalList signals={selected.signals} emptyTitle='No risk indicators'
                  emptyHint='No anomaly rules matched the current records.' />
              ) : (
                <p className='text-sm text-gray-500'>No risk indicators for this project.</p>
              )}
            </div>
            <div className='pt-2'>
              <Link to={'/projects/' + selected.projectId} className='gc-btn gc-btn-primary gc-btn-sm'>
                View full project analysis
              </Link>
              <p className='mt-1 text-xs text-gray-500'>
                Opens the project detail page - the AI Risk & Anomaly tab shows the complete analysis.
              </p>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

function StatCard({ label, value, tone = 'tone-slate' }) {
  const tag = label.includes('High') ? 'HIGH'
    : label.includes('Medium') ? 'MEDIUM'
    : label.includes('Low') ? 'LOW'
    : label.includes('Review') ? 'REVIEW' : 'TOTAL';
  return (
    <div className='bg-white p-4 gc-hover-lift gc-card-interactive gc-animate-entrance'>
      <p className='gc-eyebrow text-gray-500'>{label}</p>
      <p className='text-3xl font-bold mt-2 tracking-tight'
        style={{ fontFamily: 'var(--gc-font-display)', color: 'var(--gc-navy)' }}>
        <CountUp value={value} />
      </p>
      <span className={`inline-block mt-2 gc-badge ${tone}`}>{tag}</span>
    </div>
  );
}
