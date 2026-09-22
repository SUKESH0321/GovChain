import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import ProjectForm from '../components/ProjectForm';
import ErrorState from '../components/ui/ErrorState';
import { useToast } from '../context/ToastContext';
import { getProjectById, updateProject } from '../services/project.service';

export default function ProjectEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [project, setProject] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setProject(null);
    getProjectById(id)
      .then((data) => setProject(data.project))
      .catch((err) => setLoadError(err.message));
  }, [id]);

  async function handleSubmit(payload) {
    setError(null);
    setSubmitting(true);

    try {
      await updateProject(id, payload);
      toast.success('Project updated.');
      navigate(`/projects/${id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) {
    return <ErrorState message={loadError} />;
  }

  if (!project) {
    return <p className="text-gray-500">Loading…</p>;
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <p className="gc-eyebrow">Projects</p>
        <h1 className="text-2xl mt-1">Edit project</h1>
      </div>

      <div className="gc-panel p-6">
        {error && <p className="text-sm text-red-700 mb-4">{error}</p>}
        <ProjectForm
          initial={project}
          onSubmit={handleSubmit}
          submitLabel="Save changes"
          submitting={submitting}
        />
      </div>

      <Link to={`/projects/${id}`} className="gc-link">← Back to project</Link>
    </div>
  );
}