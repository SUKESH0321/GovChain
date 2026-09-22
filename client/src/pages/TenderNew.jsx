import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import ErrorState from '../components/ui/ErrorState';
import LoadingState from '../components/ui/LoadingState';
import { useToast } from '../context/ToastContext';
import { getProjects } from '../services/project.service';
import { createTender } from '../services/tender.service';

export default function TenderNew() {
  const navigate = useNavigate();
  const toast = useToast();
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
      toast.success('Tender created.');
      navigate(`/tenders/${data.tender.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !projects) {
    return <ErrorState message={error} />;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <p className="gc-eyebrow">Tenders</p>
        <h1 className="text-2xl mt-1">Create tender</h1>
      </div>

      <div className="gc-panel p-6">
        {projects === null ? (
          <LoadingState rows={3} cols={2} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <p className="text-sm text-red-700">{error}</p>}

            <div className="gc-field">
              <label htmlFor="project" className="gc-label">Project</label>
              <select
                id="project"
                required
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="gc-select"
              >
                <option value="">Select a project…</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} (ID {project.id})
                  </option>
                ))}
              </select>
            </div>

            <div className="gc-field">
              <label htmlFor="title" className="gc-label">Title</label>
              <input
                id="title"
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="gc-input"
                placeholder="e.g. Construction tender for New City Bridge"
              />
            </div>

            <div className="gc-field">
              <label htmlFor="description" className="gc-label">Description</label>
              <textarea
                id="description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="gc-textarea"
                placeholder="Scope of work for the tender"
              />
            </div>

            <div className="gc-field">
              <label htmlFor="tender_amount" className="gc-label">Tender amount</label>
              <input
                id="tender_amount"
                type="number"
                min="0"
                step="0.01"
                required
                value={tenderAmount}
                onChange={(e) => setTenderAmount(e.target.value)}
                className="gc-input"
                placeholder="e.g. 4500000"
              />
            </div>

            <button type="submit" disabled={submitting} className="gc-btn gc-btn-primary">
              {submitting ? 'Creating…' : 'Create Tender'}
            </button>
          </form>
        )}
      </div>

      <Link to="/tenders" className="gc-link">← Back to tenders</Link>
    </div>
  );
}