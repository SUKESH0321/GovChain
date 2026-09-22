import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import BlockchainAuditHistory from '../components/BlockchainAuditHistory';
import StatusBadge from '../components/ui/StatusBadge';
import Modal from '../components/ui/Modal';
import ErrorState from '../components/ui/ErrorState';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import useBlockchainHistory from '../hooks/useBlockchainHistory';
import {
  assignContractor,
  getTenderBlockchainHistory,
  getTenderById,
} from '../services/tender.service';
import { getContractors } from '../services/user.service';

function formatTime(value) {
  return value ? String(value).slice(0, 16).replace('T', ' ') : '—';
}

export default function TenderDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();

  const [tender, setTender] = useState(null);
  const [error, setError] = useState(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [contractors, setContractors] = useState(null);
  const [contractorId, setContractorId] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Stage 2.4 · the tender's on-chain audit history (TenderCreated /
  // TenderAssigned), read from the GovChain contract event logs by the backend.
  const {
    history: chainHistory,
    meta: chainMeta,
    loading: chainLoading,
    error: chainError,
    refresh: refreshChainHistory,
  } = useBlockchainHistory(getTenderBlockchainHistory, tender?.id);

  const isOfficer = user.role === 'government_officer';

  useEffect(() => {
    getTenderById(id)
      .then((data) => setTender(data.tender))
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    if (!assignOpen) {
      return;
    }
    setContractors(null);
    setContractorId('');
    getContractors()
      .then((data) => setContractors(data.users))
      .catch((err) => toast.error(err.message));
  }, [assignOpen]);

  async function handleAssign(event) {
    event.preventDefault();
    if (!contractorId) {
      return;
    }
    setAssigning(true);
    try {
      const data = await assignContractor(tender.id, Number(contractorId));
      setTender(data.tender);
      toast.success('Contractor assigned.');
      setAssignOpen(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setAssigning(false);
    }
  }

  if (error) {
    return <ErrorState message={error} />;
  }

  if (!tender) {
    return <p className="text-gray-500">Loading…</p>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="gc-eyebrow">Tender · Record #{tender.id}</p>
          <h1 className="text-2xl mt-1">{tender.title}</h1>
          <div className="mt-2">
            <StatusBadge status={tender.status} />
          </div>
        </div>
        {isOfficer && tender.status === 'OPEN' && (
          <button type="button" className="gc-btn gc-btn-primary" onClick={() => setAssignOpen(true)}>
            Assign contractor
          </button>
        )}
      </div>

      <div className="gc-panel gc-animate-entrance gc-stagger-1 border border-gray-200">
        <div className="gc-panel-head bg-white">
          <span className="font-semibold">Tender record overview</span>
        </div>
        <div className="gc-panel-body grid md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
          <Fact label="Project" value={<Link className="gc-link" to={`/projects/${tender.project_id}`}>{tender.project_name || '—'}</Link>} />
          <Fact label="Tender amount" value={`₹${Number(tender.tender_amount).toLocaleString('en-IN')}`} />
          <Fact
            label="Contractor"
            value={tender.contractor_name ? `${tender.contractor_name} (ID ${tender.contractor_id})` : 'Not assigned'}
          />
          <Fact label="Created by" value={tender.created_by_name || '—'} />
          <Fact label="Created at" value={formatTime(tender.created_at)} />
          <Fact label="Updated at" value={formatTime(tender.updated_at)} />
          <Fact label="Description" wide value={tender.description || 'No description provided.'} />
        </div>
      </div>

      {/* Stage 2.4 · the tender's own audit trail, straight from the chain. */}
      <BlockchainAuditHistory
        history={chainHistory}
        meta={chainMeta}
        loading={chainLoading}
        error={chainError}
        onRetry={refreshChainHistory}
        title="Blockchain audit history"
        hint="Tender creation and contractor assignment as emitted by the GovChain contract event logs."
      />

      <Link to="/tenders" className="gc-link">← Back to tenders</Link>

      <Modal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        title="Assign contractor"
        width="480px"
        footer={
          <form onSubmit={handleAssign} className="contents">
            <button type="button" className="gc-btn gc-btn-outline" onClick={() => setAssignOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="gc-btn gc-btn-primary" disabled={assigning || !contractorId}>
              {assigning ? 'Assigning…' : 'Assign'}
            </button>
          </form>
        }
      >
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
            Only accounts with the Contractor role are listed. Assignment count is not
            exposed by the backend.
          </p>
        </div>
      </Modal>
    </div>
  );
}

function Fact({ label, value, wide }) {
  return (
    <div className={wide ? 'md:col-span-2' : ''}>
      <p className="gc-eyebrow">{label}</p>
      <p className="mt-0.5 whitespace-pre-line">{value}</p>
    </div>
  );
}