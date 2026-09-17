import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';
import { getProjects } from '../services/project.service';
import { getTenders } from '../services/tender.service';

const STATUS_STYLES = {
  PLANNED: 'bg-gray-200 text-gray-800',
  IN_PROGRESS: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

function formatBudget(budget) {
  return budget === null || budget === undefined ? '—' : Number(budget).toLocaleString();
}

export default function ProjectsList() {
  const { user } = useAuth();
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user.role === 'contractor') {
      // Contractors only see projects linked to tenders assigned to them.
      Promise.all([getProjects(), getTenders()])
        .then(([projectsData, tendersData]) => {
          const ids = new Set(
            tendersData.tenders
              .filter((tender) => tender.contractor_id === user.id)
              .map((tender) => tender.project_id)
          );
          setProjects(projectsData.projects.filter((project) => ids.has(project.id)));
        })
        .catch((err) => setError(err.message));
    } else {
      getProjects()
        .then((data) => setProjects(data.projects))
        .catch((err) => setError(err.message));
    }
  }, [user.id, user.role]);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow p-8 mt-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Projects</h1>
          {user.role === 'government_officer' && (
            <Link
              to="/projects/new"
              className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Create Project
            </Link>
          )}
        </div>

        {error && <p className="text-red-600">{error}</p>}

        {projects === null ? (
          <p className="text-gray-500">Loading…</p>
        ) : projects.length === 0 ? (
          <p className="text-gray-500">
            {user.role === 'contractor' ? 'No assigned projects yet.' : 'No projects yet.'}
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2">Name</th>
                <th className="py-2">Location</th>
                <th className="py-2 text-right">Budget</th>
                <th className="py-2">Status</th>
                <th className="py-2">Start</th>
                <th className="py-2">End</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => (
                <tr key={project.id} className="border-b">
                  <td className="py-2">
                    <Link
                      to={`/projects/${project.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {project.name}
                    </Link>
                  </td>
                  <td className="py-2">{project.location || '—'}</td>
                  <td className="py-2 text-right">{formatBudget(project.budget)}</td>
                  <td className="py-2">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs ${STATUS_STYLES[project.status] || 'bg-gray-200 text-gray-800'}`}
                    >
                      {project.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-2">{project.start_date || '—'}</td>
                  <td className="py-2">{project.end_date || '—'}</td>
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