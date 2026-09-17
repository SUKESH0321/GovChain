import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import StatCard from '../components/StatCard';
import { useAuth } from '../context/AuthContext';
import {
  filterMilestonesForProjects,
  getAssignedProjects,
  getAssignedTenders,
  loadOverview,
} from '../utils/stats';

export default function ContractorDashboard() {
  const { user } = useAuth();
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

  const assignedTenders = tenders === null ? null : getAssignedTenders(tenders, user.id);
  const assignedProjects =
    projects === null || assignedTenders === null
      ? null
      : getAssignedProjects(projects, assignedTenders);
  const myMilestones =
    milestones === null || assignedProjects === null
      ? null
      : filterMilestonesForProjects(milestones, assignedProjects);

  const activeMilestones =
    myMilestones === null ? null : myMilestones.filter((m) => m.status !== 'COMPLETED').length;
  const completedMilestones =
    myMilestones === null ? null : myMilestones.length - activeMilestones;

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-1">Contractor Dashboard</h1>
      <p className="text-gray-500 mb-4">
        Your assigned tenders, projects and milestones.
      </p>

      {error && <p className="text-red-600">{error}</p>}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
        <StatCard
          label="Assigned Projects"
          value={assignedProjects === null ? null : assignedProjects.length}
        />
        <StatCard
          label="Assigned Tenders"
          value={assignedTenders === null ? null : assignedTenders.length}
        />
        <StatCard label="Active Milestones" value={activeMilestones} />
        <StatCard label="Completed Milestones" value={completedMilestones} />
      </div>

      <div className="mt-6 space-x-4">
        <Link
          to="/projects"
          className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          My Projects
        </Link>
        <Link
          to="/tenders"
          className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          My Tenders
        </Link>
        <Link
          to="/milestones"
          className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          My Milestones
        </Link>
      </div>
    </div>
  );
}