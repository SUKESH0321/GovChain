import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import CountUp from '../components/ui/CountUp';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';

import LoadingState from '../components/ui/LoadingState';
import StatusBadge from '../components/ui/StatusBadge';
import { useAuth } from '../context/AuthContext';
import useWavesProfile from '../hooks/useWavesProfile';
import {
  filterMilestonesForProjects,
  getAssignedProjects,
  getAssignedTenders,
  loadOverview,
} from '../utils/stats';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function StatCell({ label, value, delay = 1 }) {
  return (
    <div className={`bg-white p-4 gc-hover-lift gc-card-interactive gc-animate-entrance gc-stagger-${delay}`}>
      <p className="gc-eyebrow text-gray-500">{label}</p>
      <p
        className="text-3xl font-bold mt-2 tracking-tight transition-transform duration-300"
        style={{ fontFamily: 'var(--gc-font-display)', color: 'var(--gc-navy)' }}
      >
        <CountUp value={value} />
      </p>
    </div>
  );
}

export default function ContractorDashboard() {
  const { user } = useAuth();
  const waves = useWavesProfile();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadOverview()
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  const view = useMemo(() => {
    if (!data) {
      return null;
    }
    const assignedTenders = getAssignedTenders(data.tenders, user.id);
    const assignedProjects = getAssignedProjects(data.projects, assignedTenders);
    const myMilestones = filterMilestonesForProjects(data.milestones, assignedProjects);
    const active = myMilestones.filter((m) => m.status !== 'COMPLETED');
    const completed = myMilestones.length - active.length;
    const upcoming = active
      .filter((m) => m.due_date && m.due_date >= today())
      .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));
    const overdue = active.filter((m) => m.due_date && m.due_date < today());
    return { assignedTenders, assignedProjects, myMilestones, active, completed, upcoming, overdue };
  }, [data, user.id]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Hero: single GradientWaves instance, low opacity, subtle parallax. */}
      <section className="gc-hero">

        <div className="gc-waves-overlay" />
        <div className="gc-hero-body">
          <p className="gc-eyebrow">Contractor workbench</p>
          <h1 className="text-2xl mt-1">My assigned work</h1>
          <p className="gc-hero-note">
            Projects and tenders awarded to you, with what needs action next.
          </p>
        </div>
      </section>

      {error ? (
        <ErrorState message={error} />
      ) : !view ? (
        <LoadingState rows={4} cols={4} />
      ) : (
        <>
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-3"
          >
            <StatCell delay={1} label="Assigned projects" value={view.assignedProjects.length} />
            <StatCell delay={2} label="Assigned tenders" value={view.assignedTenders.length} />
            <StatCell delay={3} label="Active milestones" value={view.active.length} />
            <StatCell delay={4} label="Completed milestones" value={view.completed} />
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <div className="gc-panel gc-animate-entrance gc-stagger-2">
                <div className="gc-panel-head">
                  <span className="font-semibold">What needs action</span>
                </div>
                <div className="gc-panel-body space-y-4">
                  <div>
                    <p className="gc-eyebrow mb-2">Overdue</p>
                    {view.overdue.length === 0 ? (
                      <p className="text-sm text-gray-500">Nothing overdue.</p>
                    ) : (
                      <ul className="space-y-1">
                        {view.overdue.map((m) => (
                          <li key={m.id} className="flex items-center justify-between gap-3 text-sm">
                            <Link to={`/projects/${m.project_id}`} className="gc-link">
                              {m.title}
                            </Link>
                            <span className="text-xs font-semibold text-red-700">
                              Overdue {m.due_date}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <hr className="gc-divider" />
                  <div>
                    <p className="gc-eyebrow mb-2">Due next</p>
                    {view.upcoming.length === 0 ? (
                      <p className="text-sm text-gray-500">No upcoming deadlines.</p>
                    ) : (
                      <ul className="divide-y" style={{ borderColor: 'var(--gc-line)' }}>
                        {view.upcoming.slice(0, 6).map((m) => (
                          <li
                            key={m.id}
                            className="py-1.5 flex items-center justify-between gap-3 text-sm"
                          >
                            <div>
                              <Link to={`/projects/${m.project_id}`} className="gc-link">
                                {m.title}
                              </Link>
                              <span className="text-xs text-gray-500 ml-2">{m.project_name}</span>
                            </div>
                            <span className="text-xs font-medium">{m.due_date}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              <div className="gc-panel gc-animate-entrance gc-stagger-3">
                <div className="gc-panel-head">
                  <span className="font-semibold">My work</span>
                  <span className="text-xs text-gray-500">
                    {view.assignedTenders.length} tenders awarded
                  </span>
                </div>
                <div className="gc-panel-body">
                  {view.assignedTenders.length === 0 ? (
                    <EmptyState
                      title="No tenders assigned yet"
                      hint="Once an officer assigns a tender to you, it will appear here."
                    />
                  ) : (
                    <ul className="divide-y" style={{ borderColor: 'var(--gc-line)' }}>
                      {view.assignedTenders.map((tender) => (
                        <li
                          key={tender.id}
                          className="py-2.5 flex items-center justify-between gap-3 text-sm"
                        >
                          <div className="min-w-0">
                            <Link to={`/tenders/${tender.id}`} className="gc-link">
                              {tender.title}
                            </Link>
                            <p className="text-xs text-gray-500 truncate">
                              {tender.project_name} · ₹
                              {Number(tender.tender_amount).toLocaleString('en-IN')}
                            </p>
                          </div>
                          <StatusBadge status={tender.status} />
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            <div className="gc-panel self-start">
              <div className="gc-panel-head">
                <span className="font-semibold">Quick view</span>
              </div>
              <div className="gc-panel-body space-y-4">
                <div>
                  <p className="gc-eyebrow mb-2">My projects</p>
                  {view.assignedProjects.length === 0 ? (
                    <p className="text-sm text-gray-500">None assigned.</p>
                  ) : (
                    <ul className="space-y-2">
                      {view.assignedProjects.map((project) => (
                        <li key={project.id} className="text-sm">
                          <Link to={`/projects/${project.id}`} className="gc-link">
                            {project.name}
                          </Link>
                          <p className="text-xs text-gray-500">{project.location || '—'}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <hr className="gc-divider" />
                <div>
                  <p className="gc-eyebrow mb-2">Milestone progress</p>
                  {view.myMilestones.length === 0 ? (
                    <p className="text-sm text-gray-500">No milestones recorded.</p>
                  ) : (
                    <p className="text-sm">
                      {view.completed} of {view.myMilestones.length} completed
                      <span
                        className="block h-2 rounded-full mt-1.5"
                        style={{ background: 'var(--gc-line)' }}
                      >
                        <span
                          className="block h-2 rounded-full transition-all duration-500"
                          style={{
                            width: `${(view.completed / view.myMilestones.length) * 100}%`,
                            background: 'var(--gc-green)',
                          }}
                        />
                      </span>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}