import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import StatCard from '../components/StatCard';
import { countActiveProjects, loadOverview } from '../utils/stats';

export default function OfficerDashboard() {
  const [projects, setProjects] = useState(null);
  const [tenders, setTenders] = useState(null);
  const [milestones, setMilestones] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadOverview()
      .then((data) => {
        setProjects(data.projects);
        setTenders(data.tenders);
        setMilestones(data.milestones);
      })
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-1">Government Officer Dashboard</h1>
      <p className="text-gray-500 mb-4">
        Overview of registered projects, tenders and milestones.
      </p>

      {error && <p className="text-red-600">{error}</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
        <StatCard
          label="Total Projects"
          value={projects === null ? null : projects.length}
        />
        <StatCard
          label="Active Projects"
          value={projects === null ? null : countActiveProjects(projects)}
        />
        <StatCard
          label="Total Tenders"
          value={tenders === null ? null : tenders.length}
        />
        <StatCard
          label="Total Milestones"
          value={milestones === null ? null : milestones.length}
        />
      </div>

      <div className="mt-6 space-x-4">
        <Link
          to="/projects"
          className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          View Projects
        </Link>
        <Link
          to="/projects/new"
          className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Create Project
        </Link>
        <Link
          to="/tenders/new"
          className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          + Create Tender
        </Link>
      </div>
    </div>
  );
}