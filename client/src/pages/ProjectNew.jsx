import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import ProjectForm from '../components/ProjectForm';
import { createProject } from '../services/project.service';

export default function ProjectNew() {
  const navigate = useNavigate();
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(payload) {
    setError(null);
    setSubmitting(true);

    try {
      const data = await createProject(payload);
      navigate(`/projects/${data.project.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto bg-white rounded-lg shadow p-8 mt-10">
        <h1 className="text-2xl font-bold mb-6">Create Project</h1>

        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

        <ProjectForm onSubmit={handleSubmit} submitLabel="Create Project" submitting={submitting} />

        <Link to="/projects" className="inline-block text-blue-600 hover:underline mt-4">
          ← Back to Projects
        </Link>
      </div>
    </main>
  );
}