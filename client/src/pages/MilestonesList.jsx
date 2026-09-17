import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { getTenders } from '../services/tender.service';
import { getAssignedTenders, loadAllMilestones } from '../utils/stats';

const STATUS_STYLES = {
  PENDING: 'bg-gray-200 text-gray-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
};

// Milestones across the user's visible projects.
// Contractors only see milestones of projects they are assigned to; auditors
// (and officers) see all. Read-only — status changes happen on project details.
export default function MilestonesList() {
  const { user } = useAuth();
  const [milestones, setMilestones] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const all = await loadAllMilestones();
        if (cancelled) {
          return;
        }

        if (user.role === 'contractor') {
          const { tenders } = await getTenders();
          if (cancelled) {
            return;
          }
          const ids = new Set(getAssignedTenders(tenders, user.id).map((t) => t.project_id));
          setMilestones(all.filter((m) => ids.has(m.project_id)));
        } else {
          setMilestones(all);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user.id, user.role]);

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">
        {user.role === 'contractor' ? 'My Milestones' : 'Milestones'}
      </h1>

      {error && <p className="text-red-600">{error}</p>}

      {milestones === null ? (
        <p className="text-gray-500">Loading…</p>
      ) : milestones.length === 0 ? (
        <p className="text-gray-500">
          {user.role === 'contractor' ? 'No assigned milestones yet.' : 'No milestones yet.'}
        </p>
      ) : (
        <table className="w-full text-left text-sm bg-white rounded-lg shadow">
          <thead>
            <tr className="border-b">
              <th className="py-2 px-3">Milestone</th>
              <th className="py-2 px-3">Project</th>
              <th className="py-2 px-3 text-right">Amount</th>
              <th className="py-2 px-3">Due date</th>
              <th className="py-2 px-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {milestones.map((milestone) => (
              <tr key={milestone.id} className="border-b">
                <td className="py-2 px-3">{milestone.title}</td>
                <td className="py-2 px-3">
                  <Link
                    to={`/projects/${milestone.project_id}`}
                    className="text-blue-600 hover:underline"
                  >
                    {milestone.project_name || '—'}
                  </Link>
                </td>
                <td className="py-2 px-3 text-right">
                  {Number(milestone.amount).toLocaleString()}
                </td>
                <td className="py-2 px-3">{milestone.due_date || '—'}</td>
                <td className="py-2 px-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs ${STATUS_STYLES[milestone.status] || 'bg-gray-200 text-gray-800'}`}
                  >
                    {milestone.status.replace('_', ' ')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}