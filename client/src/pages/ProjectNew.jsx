import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import ProjectForm from '../components/ProjectForm';
import { useToast } from '../context/ToastContext';
import { createProject } from '../services/project.service';

export default function ProjectNew() {
  const navigate = useNavigate();
  const toast = useToast();
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(payload) {
    setError(null);
    setSubmitting(true);

    try {
      const data = await createProject(payload);
      toast.success('Project created.');
      navigate(`/projects/${data.project.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <p className="gc-eyebrow">Projects</p>
        <h1 className="text-2xl mt-1">Create project</h1>
      </div>

      <div className="gc-panel p-6">
        {error && <p className="text-sm text-red-700 mb-4">{error}</p>}
        <ProjectForm onSubmit={handleSubmit} submitLabel="Create project" submitting={submitting} />
      </div>

      <Link to="/projects" className="gc-link">← Back to projects</Link>
    </div>
  );
}