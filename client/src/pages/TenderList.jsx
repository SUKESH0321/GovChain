import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import StatusBadge from '../components/ui/StatusBadge';
import Modal from '../components/ui/Modal';
import DataTable from '../components/ui/DataTable';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';
import LoadingState from '../components/ui/LoadingState';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import useTable from '../hooks/useTable';
import useTenders from '../hooks/useTenders';
import { assignContractor } from '../services/tender.service';
import { getContractors } from '../services/user.service';

const TENDER_STATUSES = ['OPEN', 'ASSIGNED', 'CLOSED'];

export default function TenderList() {
  const { user } = useAuth();
  const toast = useToast();
  const { tenders, loading, error, refresh } = useTenders();

  const [assignTarget, setAssignTarget] = useState(null);
  const [contractors, setContractors] = useState(null);
  const [contractorId, setContractorId] = useState('');
  const [assigning, setAssigning] = useState(false);

  const isOfficer = user.role === 'government_officer';

  const table = useTable(tenders || [], {
    searchKeys: ['title', 'project_name', 'contractor_name'],
    initialSort: { key: 'title', dir: 'asc' },
  });

  useEffect(() => {
    if (!assignTarget) {
      return;
    }
    setContractors(null);
    setContractorId('');
    getContractors()
      .then((data) => setContractors(data.users))
      .catch((err) => toast.error(err.message));
  }, [assignTarget]);

  async function handleAssign(event) {
    event.preventDefault();
    if (!contractorId) {
      return;
    }
    setAssigning(true);
    try {
      await assignContractor(assignTarget.id, Number(contractorId));
      toast.success('Contractor assigned to tender.');
      setAssignTarget(null);
      refresh();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAssigning(false);
    }
  }

  const columns = [
    {
      key: 'title',
      label: 'Tender',
      sortable: true,
      render: (t) => (
        <Link to={`/tenders/${t.id}`} className="gc-link" onClick={(e) => e.stopPropagation()}>
          {t.title}
        </Link>
      ),
    },
    {
      key: 'project',
      label: 'Project',
      render: (t) => (
        <Link
          to={`/projects/${t.project_id}`}
          className="gc-link"
          onClick={(e) => e.stopPropagation()}
        >
          {t.project_name || '—'}
        </Link>
      ),
    },
    {
      key: 'tender_amount',
      label: 'Amount',
      sortable: true,
      align: 'right',
      render: (t) => `₹${Number(t.tender_amount).toLocaleString('en-IN')}`,
    },
    { key: 'contractor', label: 'Contractor', render: (t) => t.contractor_name || '—' },
    { key: 'status', label: 'Status', sortable: true, render: (t) => <StatusBadge status={t.status} /> },
    {
      key: 'actions',
      label: '',
      render: (t) =>
        isOfficer && t.status === 'OPEN' ? (
          <button
            type="button"
            className="gc-btn gc-btn-outline gc-btn-sm"
            onClick={(e) => {
              e.stopPropagation();
              setAssignTarget(t);
            }}
          >
            Assign
          </button>
        ) : null,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="gc-eyebrow">Tenders</p>
          <h1 className="text-2xl mt-1">
            {user.role === 'contractor' ? 'My tenders' : 'Tender register'}
          </h1>
        </div>
        {isOfficer && (
          <Link to="/tenders/new" className="gc-btn gc-btn-primary">+ Create tender</Link>
        )}
      </div>

      {loading ? (
        <LoadingState rows={6} cols={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={refresh} />
      ) : (
        <div className="gc-panel gc-animate-entrance gc-stagger-1 border border-gray-200">
          <div className="px-4 pt-4 flex flex-wrap gap-2">
            <div className="gc-search-input flex-1 min-w-[200px]">
              <span className="gc-search-icon">⌕</span>
              <input
                className="gc-input"
                placeholder="Search tenders…"
                value={table.search}
                onChange={(e) => table.setSearch(e.target.value)}
              />
            </div>
            <select
              className="gc-select"
              style={{ width: 'auto' }}
              value={table.statusFilter}
              onChange={(e) => table.setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              {TENDER_STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
          <div className="p-4">
            <DataTable
              columns={columns}
              rows={table.rows}
              sort={table.sort}
              onSort={table.toggleSort}
              empty={
                <EmptyState
                  title={user.role === 'contractor' ? 'No assigned tenders' : 'No tenders yet'}
                  hint={
                    user.role === 'contractor'
                      ? 'Tenders appear here once an officer assigns you as contractor.'
                      : 'Create a tender or clear the current filters.'
                  }
                />
              }
            />
          </div>
        </div>
      )}

      <Modal
        open={!!assignTarget}
        onClose={() => setAssignTarget(null)}
        title="Assign contractor"
        width="480px"
        footer={
          <form onSubmit={handleAssign} className="contents">
            <button type="button" className="gc-btn gc-btn-outline" onClick={() => setAssignTarget(null)}>
              Cancel
            </button>
            <button type="submit" className="gc-btn gc-btn-primary" disabled={assigning || !contractorId}>
              {assigning ? 'Assigning…' : 'Assign'}
            </button>
          </form>
        }
      >
        {assignTarget && (
          <div className="space-y-4">
            <div className="text-sm">
              <p className="gc-eyebrow">Tender</p>
              <p className="font-semibold">{assignTarget.title}</p>
              <p className="text-gray-500">{assignTarget.project_name}</p>
            </div>
            <div className="gc-field">
              <label htmlFor="contractor" className="gc-label">Contractor</label>
              <select
                id="contractor"
                required
                value={contractorId}
                onChange={(e) => setContractorId(e.target.value)}
                className="gc-select"
              >
                <option value="">Select a contractor…</option>
                {contractors === null ? (
                  <option disabled>Loading contractors…</option>
                ) : contractors.length === 0 ? (
                  <option disabled>No contractors registered</option>
                ) : (
                  contractors.map((contractor) => (
                    <option key={contractor.id} value={contractor.id}>
                      {contractor.name} ({contractor.email})
                    </option>
                  ))
                )}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Only accounts with the Contractor role are listed.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}