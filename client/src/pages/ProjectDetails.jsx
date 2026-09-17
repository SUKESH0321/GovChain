import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import MilestoneForm from '../components/MilestoneForm';
import { useAuth } from '../context/AuthContext';
import {
  createMilestone,
  getProjectMilestones,
  updateMilestoneStatus,
} from '../services/milestone.service';
import { getProjectById } from '../services/project.service';
import { getTenders } from '../services/tender.service';

const MILESTONE_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];

function formatValue(value) {
  return value || '—';
}

export default function ProjectDetails() {
  const { id } = useParams();
  const { user } = useAuth();

  const [project, setProject] = useState(null);
  const [tenders, setTenders] = useState([]);
  const [tenderError, setTenderError] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [milestoneError, setMilestoneError] = useState(null);
  const [statusValues, setStatusValues] = useState({});
  const [updatingId, setUpdatingId] = useState(null);
  const [creatingMilestone, setCreatingMilestone] = useState(false);
  const [milestoneFormKey, setMilestoneFormKey] = useState(0);
  const [error, setError] = useState(null);

  function loadMilestones(projectId) {
    getProjectMilestones(projectId)
      .then((data) => {
        setMilestones(data.milestones);
        const next = {};
        data.milestones.forEach((m) => {
          next[m.id] = m.status;
        });
        setStatusValues(next);
      })
      .catch((err) => setMilestoneError(err.message));
  }

  useEffect(() => {
    setProject(null);
    setError(null);
    getProjectById(id)
      .then((data) => {
        setProject(data.project);
        getTenders(data.project.id)
          .then((tendersData) => setTenders(tendersData.tenders))
          .catch((err) => setTenderError(err.message));
      })
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    if (!project) {
      return;
    }
    setMilestoneError(null);
    loadMilestones(project.id);
  }, [project]);

  if (error) {
    return <p className="text-red-600 mt-8">Could not load the project: {error}</p>;
  }

  if (!project) {
    return <p className="text-center text-gray-500 mt-8">Loading…</p>;
  }

  const canManageMilestones = user.role === 'government_officer';
  const canUpdateMilestoneStatus =
    user.role === 'government_officer' || user.role === 'contractor';

  async function handleMilestoneCreate(milestoneData) {
    setMilestoneError(null);
    setCreatingMilestone(true);
    try {
      await createMilestone(project.id, milestoneData);
      loadMilestones(project.id);
      setMilestoneFormKey((key) => key + 1); // reset the form
    } catch (err) {
      setMilestoneError(err.message);
    } finally {
      setCreatingMilestone(false);
    }
  }

  async function handleStatusUpdate(milestone) {
    const nextStatus = statusValues[milestone.id];
    if (!nextStatus || nextStatus === milestone.status) {
      return;
    }
    setUpdatingId(milestone.id);
    setMilestoneError(null);
    try {
      await updateMilestoneStatus(milestone.id, nextStatus);
      loadMilestones(project.id);
    } catch (err) {
      setMilestoneError(err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-8 mt-10">
        <h1 className="text-2xl font-bold mb-2">{project.name}</h1>
        <p className="text-sm text-gray-500 mb-6">
          Status: <span className="font-medium">{project.status.replace('_', ' ')}</span>
        </p>

        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-gray-500">Description</dt>
            <dd className="whitespace-pre-line">{formatValue(project.description)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Budget</dt>
            <dd>{Number(project.budget).toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Location</dt>
            <dd>{formatValue(project.location)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Start date</dt>
            <dd>{formatValue(project.start_date)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">End date</dt>
            <dd>{formatValue(project.end_date)}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Created by</dt>
            <dd>{formatValue(project.created_by_name)} (ID {project.created_by})</dd>
          </div>
          <div>
            <dt className="text-gray-500">Created at</dt>
            <dd>{formatValue(String(project.created_at).slice(0, 16).replace('T', ' '))}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Updated at</dt>
            <dd>{formatValue(String(project.updated_at).slice(0, 16).replace('T', ' '))}</dd>
          </div>
        </dl>

        <div className="mt-6 space-x-4">
          {user.role === 'government_officer' && (
            <>
              <Link
                to={`/projects/${project.id}/edit`}
                className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Edit Project
              </Link>
              <Link
                to={`/tenders/new?project_id=${project.id}`}
                className="inline-block bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Create Tender
              </Link>
            </>
          )}
          <Link to="/projects" className="text-blue-600 hover:underline">
            ← Back to Projects
          </Link>
        </div>

        {/* Tenders for this project */}
        <section className="mt-8">
          <h2 className="text-xl font-bold mb-3">Tenders</h2>
          {tenderError && <p className="text-red-600 text-sm mb-2">{tenderError}</p>}
          {tenders.length === 0 ? (
            <p className="text-gray-500 text-sm">No tenders yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2">Title</th>
                  <th className="py-2 text-right">Amount</th>
                  <th className="py-2">Contractor</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {tenders.map((tender) => (
                  <tr key={tender.id} className="border-b">
                    <td className="py-2">
                      <Link
                        to={`/tenders/${tender.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {tender.title}
                      </Link>
                    </td>
                    <td className="py-2 text-right">
                      {Number(tender.tender_amount).toLocaleString()}
                    </td>
                    <td className="py-2">{tender.contractor_name || '—'}</td>
                    <td className="py-2">{tender.status.replace('_', ' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* Milestones for this project */}
        <section className="mt-8">
          <h2 className="text-xl font-bold mb-3">Milestones</h2>
          {milestoneError && <p className="text-red-600 text-sm mb-2">{milestoneError}</p>}
          {milestones.length === 0 ? (
            <p className="text-gray-500 text-sm">No milestones yet.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2">Title</th>
                  <th className="py-2 text-right">Amount</th>
                  <th className="py-2">Due date</th>
                  <th className="py-2">Status</th>
                  {canUpdateMilestoneStatus && <th className="py-2">Update</th>}
                </tr>
              </thead>
              <tbody>
                {milestones.map((milestone) => (
                  <tr key={milestone.id} className="border-b">
                    <td className="py-2">{milestone.title}</td>
                    <td className="py-2 text-right">
                      {Number(milestone.amount).toLocaleString()}
                    </td>
                    <td className="py-2">{milestone.due_date || '—'}</td>
                    <td className="py-2">{milestone.status.replace('_', ' ')}</td>
                    {canUpdateMilestoneStatus && (
                      <td className="py-2">
                        <div className="flex items-center space-x-2">
                          <select
                            value={statusValues[milestone.id] || milestone.status}
                            onChange={(e) =>
                              setStatusValues((current) => ({
                                ...current,
                                [milestone.id]: e.target.value,
                              }))
                            }
                            className="border border-gray-300 rounded px-2 py-1 text-sm"
                          >
                            {MILESTONE_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s.replace('_', ' ')}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => handleStatusUpdate(milestone)}
                            disabled={updatingId === milestone.id}
                            className="text-blue-600 hover:underline text-sm"
                          >
                            {updatingId === milestone.id ? 'Updating…' : 'Update'}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {canManageMilestones && (
            <div className="mt-4 border rounded p-4">
              <h3 className="text-lg font-semibold mb-2">Create Milestone</h3>
              <MilestoneForm
                key={milestoneFormKey}
                onSubmit={handleMilestoneCreate}
                submitting={creatingMilestone}
              />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}