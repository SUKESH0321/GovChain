import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { assignContractor, getTenderById } from '../services/tender.service';
import { getContractors } from '../services/user.service';

function formatValue(value) {
  return value || '—';
}

export default function TenderDetails() {
  const { id } = useParams();
  const { user } = useAuth();

  const [tender, setTender] = useState(null);
  const [error, setError] = useState(null);
  const [contractors, setContractors] = useState(null);
  const [contractorId, setContractorId] = useState('');
  const [assignError, setAssignError] = useState(null);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    getTenderById(id)
      .then((data) => setTender(data.tender))
      .catch((err) => setError(err.message));

    if (user.role === 'government_officer') {
      getContractors()
        .then((data) => setContractors(data.users))
        .catch((err) => setAssignError(err.message));
    }
  }, [id]);

  if (error) {
    return <p className="text-red-600 mt-8">Could not load the tender: {error}</p>;
  }

  if (!tender) {
    return <p className="text-center text-gray-500 mt-8">Loading…</p>;
  }

  const canAssign = user.role === 'government_officer' && tender.status === 'OPEN';

  async function handleAssign(event) {
    event.preventDefault();
    if (!contractorId) {
      return;
    }
    setAssignError(null);
    setAssigning(true);
    try {
      const data = await assignContractor(tender.id, Number(contractorId));
      setTender(data.tender);
      setContractorId('');
    } catch (err) {
      setAssignError(err.message);
    } finally {
      setAssigning(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-8 mt-10">
        <h1 className="text-2xl font-bold mb-2">{tender.title}</h1>
        <p className="text-sm text-gray-500 mb-6">
          Status: <span className="font-medium">{tender.status.replace('_', ' ')}</span>
        </p>

        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-gray-500">Project</dt>
            <dd>
              <Link
                to={`/projects/${tender.project_id}`}
                className="text-blue-600 hover:underline"
              >
                {formatValue(tender.project_name)}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Description</dt>
            <dd className="whitespace-pre-line">{formatValue(tender.description)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Tender amount</dt>
            <dd>{Number(tender.tender_amount).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Contractor</dt>
            <dd>
              {tender.contractor_name
                ? `${tender.contractor_name} (ID ${tender.contractor_id})`
                : 'Not assigned'}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Created by</dt>
            <dd>{formatValue(tender.created_by_name)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Created at</dt>
            <dd>{formatValue(String(tender.created_at).slice(0, 16).replace('T', ' '))}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Updated at</dt>
            <dd>{formatValue(String(tender.updated_at).slice(0, 16).replace('T', ' '))}</dd>
          </div>
        </dl>

        {canAssign && (
          <div className="mt-6 border rounded p-4">
            <h2 className="text-lg font-semibold mb-2">Assign Contractor</h2>
            <form onSubmit={handleAssign} className="space-y-3">
              <select
                id="contractor"
                required
                value={contractorId}
                onChange={(e) => setContractorId(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2"
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

              {assignError && <p className="text-red-600 text-sm">{assignError}</p>}

              <button
                type="submit"
                disabled={assigning || contractors === null || contractors.length === 0}
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {assigning ? 'Assigning…' : 'Assign Contractor'}
              </button>
            </form>
          </div>
        )}

        <div className="mt-6 space-x-4">
          {user.role === 'government_officer' && (
            <Link to="/tenders/new" className="text-blue-600 hover:underline">
              Create another tender
            </Link>
          )}
          <Link to="/tenders" className="text-blue-600 hover:underline">
            ← Back to Tenders
          </Link>
        </div>
      </div>
    </main>
  );
}