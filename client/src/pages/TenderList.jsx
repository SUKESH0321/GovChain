import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { getTenders } from '../services/tender.service';

const STATUS_STYLES = {
  OPEN: 'bg-green-100 text-green-800',
  ASSIGNED: 'bg-blue-100 text-blue-800',
  CLOSED: 'bg-gray-200 text-gray-800',
};

export default function TenderList() {
  const { user } = useAuth();
  const [tenders, setTenders] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    getTenders()
      .then((data) => {
        if (user.role === 'contractor') {
          // Contractors only see the tenders assigned to them.
          setTenders(data.tenders.filter((tender) => tender.contractor_id === user.id));
        } else {
          setTenders(data.tenders);
        }
      })
      .catch((err) => setError(err.message));
  }, [user.id, user.role]);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-8 mt-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Tenders</h1>
          {user.role === 'government_officer' && (
            <Link
              to="/tenders/new"
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Create Tender
            </Link>
          )}
        </div>

        {error && <p className="text-red-600">{error}</p>}

        {tenders === null ? (
          <p className="text-gray-500">Loading…</p>
        ) : tenders.length === 0 ? (
          <p className="text-gray-500">
            {user.role === 'contractor' ? 'No assigned tenders yet.' : 'No tenders yet.'}
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2">Title</th>
                <th className="py-2">Project</th>
                <th className="py-2 text-right">Amount</th>
                <th className="py-2">Contractor</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {tenders.map((tender) => (
                <tr key={tender.id} className="border-b">
                  <td className="py-2">
                    <Link
                      to={`/tenders/${tender.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {tender.title}
                    </Link>
                  </td>
                  <td className="py-2">
                    <Link
                      to={`/projects/${tender.project_id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {tender.project_name || '—'}
                    </Link>
                  </td>
                  <td className="py-2 text-right">
                    {Number(tender.tender_amount).toLocaleString()}
                  </td>
                  <td className="py-2">{tender.contractor_name || '—'}</td>
                  <td className="py-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs ${STATUS_STYLES[tender.status] || 'bg-gray-200 text-gray-800'}`}
                    >
                      {tender.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <Link to="/dashboard" className="inline-block text-blue-600 hover:underline mt-4">
          ← Back to Dashboard
        </Link>
      </div>
    </main>
  );
}