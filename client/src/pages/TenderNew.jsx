import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { getProjects } from '../services/project.service';
import { createTender } from '../services/tender.service';

export default function TenderNew() {
  const navigate = useNavigate();
  const { searchParams } = useSearchParams();

  const [projects, setProjects] = useState(null);
  const [projectId, setProjectId] = useState(searchParams.get('project_id') || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tenderAmount, setTenderAmount] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getProjects()
      .then((data) => setProjects(data.projects))
      .catch((err) => setError(err.message));
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const data = await createTender({
        project_id: Number(projectId),
        title,
        description,
        tender_amount: tenderAmount,
      });
      navigate(`/tenders/${data.tender.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto bg-white rounded-lg shadow p-8 mt-10">
        <h1 className="text-2xl font-bold mb-6">Create Tender</h1>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="project" className="block text-sm font-medium mb-1">
              Project
            </label>
            <select
              id="project"
              required
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            >
              <option value="">Select a project…</option>
              {projects === null ? (
                <option disabled>Loading projects…</option>
              ) : (
                projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} (ID {project.id})
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-1">
              Title
            </label>
            <input
              id="title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="e.g. Construction tender for New City Bridge"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium mb-1">
              Description
            </label>
            <textarea
              id="description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="Scope of work for the tender"
            />
          </div>

          <div>
            <label htmlFor="tender_amount" className="block text-sm font-medium mb-1">
              Tender amount
            </label>
            <input
              id="tender_amount"
              type="number"
              min="0"
              step="0.01"
              required
              value={tenderAmount}
              onChange={(e) => setTenderAmount(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
              placeholder="e.g. 4500000"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Creating…' : 'Create Tender'}
          </button>
        </form>

        <Link to="/tenders" className="inline-block text-blue-600 hover:underline mt-4">
          ← Back to Tenders
        </Link>
      </div>
    </main>
  );
}