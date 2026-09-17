import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import ProjectForm from '../components/ProjectForm';
import { getProjectById, updateProject } from '../services/project.service';

export default function ProjectEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

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

  if (loadError) {
    return <p className="text-red-600 mt-8">Could not load the project: {loadError}</p>;
  }

  if (!project) {
    return <p className="text-center text-gray-500 mt-8">Loading…</p>;
  }

  async function handleSubmit(payload) {
    setError(null);
    setSubmitting(true);

    try {
      await updateProject(id, payload);
      navigate(`/projects/${id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto bg-white rounded-lg shadow p-8 mt-10">
        <h1 className="text-2xl font-bold mb-6">Edit Project</h1>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <ProjectForm
          initial={project}
          onSubmit={handleSubmit}
          submitLabel="Save Changes"
          submitting={submitting}
        />

        <Link to={`/projects/${id}`} className="inline-block text-blue-600 hover:underline mt-4">
          ← Back to Project
        </Link>
      </div>
    </main>
  );
}