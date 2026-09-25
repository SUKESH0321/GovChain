import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import MilestoneForm from '../components/MilestoneForm';
import MilestoneTimeline from '../components/MilestoneTimeline';
import ProjectStageTimeline from '../components/ProjectStageTimeline';
import BlockchainAuditHistory from '../components/BlockchainAuditHistory';
import RiskAnalysisPanel from '../components/RiskAnalysisPanel';
import { LEVEL_TONE } from '../components/RiskSignals';
import EmptyState from '../components/ui/EmptyState';
import ErrorState from '../components/ui/ErrorState';

import LoadingState from '../components/ui/LoadingState';
import Modal from '../components/ui/Modal';
import StatusBadge from '../components/ui/StatusBadge';
import Tabs from '../components/ui/Tabs';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import useBlockchainHistory from '../hooks/useBlockchainHistory';
import useMilestones from '../hooks/useMilestones';
import usePayments from '../hooks/usePayments';
import useProjectRisk from '../hooks/useProjectRisk';
import useWavesProfile from '../hooks/useWavesProfile';
import { getProjectBlockchainHistory, getProjectById } from '../services/project.service';
import { getTenders } from '../services/tender.service';

const MILESTONE_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED'];

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'tender', label: 'Tender' },
  { key: 'milestones', label: 'Milestones' },
  { key: 'activity', label: 'Activity' },
  // Stage 2.4 · the immutable on-chain audit trail of the project.
  { key: 'blockchain', label: 'Blockchain' },
  // Stage 4.1 · deterministic AI risk & anomaly indicators, calculated from the
  // existing project/tender/milestone/payment records when the tab is opened.
  { key: 'risk', label: 'AI Risk & Anomaly' },
];

function formatTime(value) {
  return value ? String(value).slice(0, 16).replace('T', ' ') : '—';
}
// Compact label/value field used across the detail panels.
function F({ label, value, wide = false }) {
  return (
    <div className={wide ? 'md:col-span-2' : ''}>
      <p className="gc-eyebrow">{label}</p>
      <p className="mt-0.5 whitespace-pre-line">{value}</p>
    </div>
  );
}

export default function ProjectDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const waves = useWavesProfile();

  const [project, setProject] = useState(null);
  const [tenders, setTenders] = useState([]);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('overview');
  const [milestoneModal, setMilestoneModal] = useState(null); // { mode } | { mode, milestone }
  const [editStatus, setEditStatus] = useState('PENDING');
  const [updatingId, setUpdatingId] = useState(null);
  const [savingMilestone, setSavingMilestone] = useState(false);
  const [reviewReason, setReviewReason] = useState('');

  const {
    milestones,
    loading: milestonesLoading,
    create,
    updateStatus,
    submit: submitMilestone,
    verify: verifyMilestone,
    reject: rejectMilestone,
  } = useMilestones(id);

  // Stage 3.1 · payment requests for this project (contractors: their own only,
  // filtered by the backend RBAC). Used to show the current payment status on
  // verified milestones.
  const { payments } = usePayments();
  const projectPayments = useMemo(
    () => (payments || []).filter((p) => p.project_id === Number(id)),
    [payments, id]
  );

  // Stage 2.4 · the project-wide blockchain audit history is loaded only while
  // its tab is open, so the event logs are queried on demand.
  const {
    history: chainHistory,
    meta: chainMeta,
    loading: chainLoading,
    error: chainError,
    refresh: refreshChainHistory,
  } = useBlockchainHistory(getProjectBlockchainHistory, project?.id, tab === 'blockchain');

  // Stage 4.1 · the AI risk analysis is calculated on demand, only while its tab
  // is open (same lazy pattern as the blockchain history above).
  const {
    analysis: riskAnalysis,
    loading: riskLoading,
    error: riskError,
    refresh: refreshRiskAnalysis,
  } = useProjectRisk(id, tab === 'risk' || tab === 'overview');

  const isOfficer = user.role === 'government_officer';
  const isAuditor = user.role === 'auditor';
  const canUpdateMilestones = isOfficer || user.role === 'contractor';
  // Stage 2.3 · who may drive the milestone review lifecycle. The backend
  // enforces the same rules: officers/auditors verify or reject, the officer or
  // the contractor assigned to the project's tender submits.
  const canSubmitMilestones = isOfficer || user.role === 'contractor';
  const canReviewMilestones = isOfficer || isAuditor;

  useEffect(() => {
    setProject(null);
    setError(null);
    getProjectById(id)
      .then((data) => setProject(data.project))
      .catch((err) => setError(err.message));
  }, [id]);

  useEffect(() => {
    getTenders()
      .then((data) => setTenders(data.tenders.filter((t) => t.project_id === Number(id))))
      .catch(() => setTenders([]));
  }, [id]);

  const assignedTender = tenders.find((t) => t.contractor_id);

  // Derived financial summary — computed from real API records only.
  const budgetTotal = project ? Number(project.budget || 0) : 0;
  const tenderTotal = tenders.reduce((sum, t) => sum + Number(t.tender_amount || 0), 0);
  const milestoneTotal = (milestones || []).reduce((sum, m) => sum + Number(m.amount || 0), 0);
  const milestonesDone = (milestones || []).filter((m) => m.status === 'COMPLETED').length;

  const activity = useMemo(() => {
    if (!project) {
      return [];
    }
    const entries = [
      { time: project.created_at, text: 'Project record created.' },
      { time: project.updated_at, text: 'Project record last updated.' },
    ];
    (milestones || []).forEach((m) => {
      entries.push({ time: m.created_at, text: `Milestone "${m.title}" created.` });
      entries.push({
        time: m.updated_at,
        text: `Milestone "${m.title}" updated — status: ${m.status.replace('_', ' ')}.`,
      });
    });
    return entries.sort((a, b) => String(b.time).localeCompare(String(a.time)));
  }, [project, milestones]);

  async function handleStatusChange(milestone, nextStatus) {
    setUpdatingId(milestone.id);
    try {
      await updateStatus(milestone.id, nextStatus);
      toast.success('Milestone status updated.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleCreateMilestone(payload) {
    setSavingMilestone(true);
    try {
      await create(payload);
      toast.success('Milestone created.');
      setMilestoneModal(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingMilestone(false);
    }
  }

  async function handleEditMilestone(event) {
    event.preventDefault();
    setSavingMilestone(true);
    try {
      await updateStatus(milestoneModal.milestone.id, editStatus);
      toast.success('Milestone status updated.');
      setMilestoneModal(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingMilestone(false);
    }
  }

  // Stage 2.3 · milestone lifecycle actions. Each call updates the milestone in
  // PostgreSQL and, once that succeeded, records the matching blockchain event
  // (the response carries the transaction hash in `blockchain`).
  async function handleSubmitMilestone(milestone) {
    setUpdatingId(milestone.id);
    try {
      await submitMilestone(milestone.id);
      toast.success('Milestone submitted for verification.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleVerifyMilestone(milestone) {
    setUpdatingId(milestone.id);
    try {
      await verifyMilestone(milestone.id);
      toast.success('Milestone verified.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleRejectMilestone(event) {
    event.preventDefault();
    if (!milestoneModal?.milestone) {
      return;
    }
    setSavingMilestone(true);
    try {
      await rejectMilestone(milestoneModal.milestone.id, reviewReason);
      toast.success('Milestone rejected.');
      setMilestoneModal(null);
      setReviewReason('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSavingMilestone(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {error ? (
        <ErrorState message={error} />
      ) : !project ? (
        <LoadingState rows={6} cols={4} />
      ) : (
        <>
          {/* Compact wave band on the header only — tables, forms and
              milestone lists below stay on plain surfaces. */}
          <section className="gc-hero gc-hero--compact">

            <div className="gc-waves-overlay" />
            <div className="gc-hero-body flex items-start justify-between gap-3 flex-wrap">
              <div>
                <p className="gc-eyebrow">Project · Record #{project.id}</p>
                <h1 className="text-2xl mt-1">{project.name}</h1>
                <div className="mt-2">
                  <StatusBadge status={project.status} />
                </div>
              </div>
              <div className="flex gap-2">
                {isOfficer && (
                  <>
                    <Link to={`/projects/${project.id}/edit`} className="gc-btn gc-btn-outline">
                      Edit
                    </Link>
                    <Link to={`/tenders/new?project_id=${project.id}`} className="gc-btn gc-btn-primary">
                      + Create tender
                    </Link>
                  </>
                )}
              </div>
            </div>
          </section>

          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Tabs tabs={TABS} active={tab} onChange={setTab} />

              {tab === 'overview' && (
                <div className="gc-panel gc-animate-entrance gc-stagger-1">
                  <div className="gc-panel-head">
                    <span className="font-semibold">Overview</span>
                  </div>
                  <div className="gc-panel-body grid md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                    <F label="Description" wide value={project.description || 'No description provided.'} />
                    <F label="Location" value={project.location || '—'} />
                    <F label="Start date" value={project.start_date || '—'} />
                    <F label="Deadline" value={project.end_date || '—'} />
                    <F label="Created by" value={project.created_by_name || '—'} />
                    <F label="Created at" value={formatTime(project.created_at)} />
                    <F label="Updated at" value={formatTime(project.updated_at)} />
                    <F
                      label="Contractor"
                      value={assignedTender ? assignedTender.contractor_name : 'Not assigned'}
                    />
                  </div>
                </div>
              )}

              {/* Stage 4.3 · compact AI risk summary that links to the full
                  Stage 4.1 analysis. Reuses the same risk-analysis endpoint —
                  no duplicate calculation runs here, and the numbers are shown
                  only once the lazy hook has actually loaded them. */}
              {tab === 'overview' && (
                <div className="gc-panel gc-animate-entrance gc-stagger-2">
                  <div className="gc-panel-head">
                    <span className="font-semibold">AI Risk Analysis</span>
                  </div>
                  <div className="gc-panel-body">
                    {riskLoading ? (
                      <p className="text-sm text-gray-500">Loading risk analysis…</p>
                    ) : riskError ? (
                      <p className="text-sm text-gray-500">
                        Risk analysis unavailable. Open the AI Risk &amp; Anomaly tab to retry.
                      </p>
                    ) : riskAnalysis ? (
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-3 flex-wrap text-sm">
                          <span className={`gc-badge ${LEVEL_TONE[riskAnalysis.riskLevel] || 'tone-slate'}`}>
                            {riskAnalysis.riskLevel}
                          </span>
                          <span className="text-gray-600">
                            Risk Level: {riskAnalysis.riskLevel} · Risk Score: {riskAnalysis.riskScore}
                            {' · Signals: '}
                            {(riskAnalysis.signals || []).length}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="gc-link text-sm font-medium"
                          onClick={() => setTab('risk')}
                        >
                          View Full Analysis →
                        </button>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No risk analysis available for this project.</p>
                    )}
                  </div>
                </div>
              )}

              {tab === 'tender' && (
                <div className="gc-panel gc-animate-entrance gc-stagger-1">
                  <div className="gc-panel-head">
                    <span className="font-semibold">Tenders</span>
                    <span className="text-xs text-gray-500">{tenders.length} records</span>
                  </div>
                  <div className="gc-panel-body">
                    {tenders.length === 0 ? (
                      <EmptyState
                        title="No tenders yet"
                        hint={isOfficer ? 'Create a tender to open this project to bidding.' : 'No tenders are linked to this project.'}
                      />
                    ) : (
                      <div className="gc-table-scroll">
                        <table className="gc-table">
                          <thead>
                            <tr>
                              <th>Tender</th>
                              <th className="text-right">Amount</th>
                              <th>Contractor</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tenders.map((tender) => (
                              <tr key={tender.id}>
                                <td className="font-medium">
                                  <Link to={`/tenders/${tender.id}`} className="gc-link">
                                    {tender.title}
                                  </Link>
                                </td>
                                <td className="text-right">
                                  ₹{Number(tender.tender_amount).toLocaleString('en-IN')}
                                </td>
                                <td>{tender.contractor_name || 'Not assigned'}</td>
                                <td><StatusBadge status={tender.status} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tab === 'milestones' && (
                <div className="gc-panel gc-animate-entrance gc-stagger-1">
                  <div className="gc-panel-head">
                    <span className="font-semibold">Milestones</span>
                    {isOfficer && (
                      <button
                        type="button"
                        className="gc-btn gc-btn-primary gc-btn-sm"
                        onClick={() => setMilestoneModal({ mode: 'create' })}
                      >
                        + Add milestone
                      </button>
                    )}
                  </div>
                  <div className="gc-panel-body">
                    {milestonesLoading ? (
                      <LoadingState rows={4} cols={3} />
                    ) : !milestones || milestones.length === 0 ? (
                      <EmptyState
                        title="No milestones yet"
                        hint="Milestones break the project into trackable execution steps."
                      />
                    ) : (
                      <MilestoneTimeline
                        milestones={milestones}
                        canUpdate={canUpdateMilestones}
                        onStatusChange={handleStatusChange}
                        onSubmit={canSubmitMilestones ? handleSubmitMilestone : undefined}
                        onVerify={canReviewMilestones ? handleVerifyMilestone : undefined}
                        onReject={
                          canReviewMilestones
                            ? (m) => {
                                setReviewReason('');
                                setMilestoneModal({ mode: 'reject', milestone: m });
                              }
                            : undefined
                        }
                        onEdit={
                          isOfficer
                            ? (m) => {
                                setEditStatus(m.status);
                                setMilestoneModal({ mode: 'edit', milestone: m });
                              }
                            : undefined
                        }
                        canRequestPayment={user.role === 'contractor'}
                        payments={projectPayments}
                        updatingId={updatingId}
                      />
                    )}
                  </div>
                </div>
              )}

              {tab === 'activity' && (
                <div className="gc-panel gc-animate-entrance gc-stagger-1">
                  <div className="gc-panel-head">
                    <span className="font-semibold">Activity</span>
                  </div>
                  <div className="gc-panel-body">
                    {activity.length === 0 ? (
                      <p className="text-sm text-gray-500">No activity recorded.</p>
                    ) : (
                      <ol className="space-y-3">
                        {activity.slice(0, 25).map((entry, index) => (
                          <li key={index} className="flex gap-3 text-sm">
                            <span className="gc-kbd self-start whitespace-nowrap">
                              {formatTime(entry.time)}
                            </span>
                            <span className="text-gray-700">{entry.text}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                    <hr className="gc-divider" />
                    <p className="text-xs text-gray-500">
                      Database activity is derived from record timestamps. The immutable audit
                      trail — with transaction hashes, blocks and actor addresses — is on the
                      Blockchain tab.
                    </p>
                  </div>
                </div>
              )}

              {/* Stage 2.4 · the on-chain audit history of the project and of the
                  tenders/milestones recorded against it, read from the GovChain
                  contract event logs by the backend. */}
              {tab === 'blockchain' && (
                <BlockchainAuditHistory
                  history={chainHistory}
                  meta={chainMeta}
                  loading={chainLoading}
                  error={chainError}
                  onRetry={refreshChainHistory}
                  title="Blockchain audit history"
                  hint="Every GovChain action recorded for this project, its tenders and its milestones, read back from the local EVM chain in blockchain order."
                />
              )}

              {/* Stage 4.1 · AI risk & anomaly analysis — deterministic,
                  explainable indicators calculated on request from the project,
                  tender, milestone and payment records. Nothing is stored and
                  nothing is written on-chain. */}
              {tab === 'risk' && (
                <RiskAnalysisPanel
                  analysis={riskAnalysis}
                  loading={riskLoading}
                  error={riskError}
                  onRetry={refreshRiskAnalysis}
                  title="AI risk analysis"
                />
              )}

              <Link to="/projects" className="gc-link">← Back to projects</Link>
            </div>

            {/* Right rail — lifecycle, financials, record facts */}
            <div className="space-y-6">
              <div className="gc-panel gc-animate-entrance gc-stagger-2 hover:border-gray-300 transition-colors">
                <div className="gc-panel-head">
                  <span className="font-semibold">Lifecycle</span>
                  <span className="text-xs text-gray-500">derived from live records</span>
                </div>
                <div className="gc-panel-body">
                  <ProjectStageTimeline project={project} tenders={tenders} />
                </div>
              </div>

              <div className="gc-panel gc-animate-entrance gc-stagger-3">
                <div className="gc-panel-head">
                  <span className="font-semibold">Financials</span>
                </div>
                <div className="gc-panel-body space-y-3 text-sm">
                  <F label="Sanctioned budget" value={`₹${budgetTotal.toLocaleString('en-IN')}`} />
                  <F
                    label="Tendered value"
                    value={
                      tenders.length
                        ? `₹${tenderTotal.toLocaleString('en-IN')} across ${tenders.length} tender${tenders.length === 1 ? '' : 's'}`
                        : 'No tenders yet'
                    }
                  />
                  <F
                    label="Milestone value"
                    value={
                      milestones && milestones.length
                        ? `₹${milestoneTotal.toLocaleString('en-IN')}`
                        : 'No milestones yet'
                    }
                  />
                  <F
                    label="Milestone completion"
                    value={
                      milestones && milestones.length
                        ? `${milestonesDone} of ${milestones.length} completed`
                        : 'No milestones yet'
                    }
                  />
                  <hr className="gc-divider" />
                  <p className="text-xs text-gray-500">
                    Values are read directly from the project, tender and milestone records.
                  </p>
                </div>
              </div>

              <div className="gc-panel gc-animate-entrance gc-stagger-4">
                <div className="gc-panel-head">
                  <span className="font-semibold">Record</span>
                </div>
                <div className="gc-panel-body space-y-3 text-sm">
                  <F label="Project ID" value={`#${project.id}`} />
                  <F label="Created" value={formatTime(project.created_at)} />
                  <F label="Last updated" value={formatTime(project.updated_at)} />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Create milestone modal */}
      <Modal
        open={milestoneModal?.mode === 'create'}
        onClose={() => setMilestoneModal(null)}
        title="New milestone"
      >
        <MilestoneForm
          onSubmit={handleCreateMilestone}
          submitting={savingMilestone}
          submitLabel="Create milestone"
        />
      </Modal>

      {/* Edit milestone (status) modal */}
      <Modal
        open={milestoneModal?.mode === 'edit'}
        onClose={() => setMilestoneModal(null)}
        title="Update milestone"
      >
        {milestoneModal?.milestone && (
          <form onSubmit={handleEditMilestone} className="space-y-4">
            <div>
              <p className="gc-eyebrow">Milestone</p>
              <p className="font-semibold">{milestoneModal.milestone.title}</p>
            </div>
            <div>
              <label htmlFor="edit-milestone-status" className="block text-sm font-medium mb-1">
                Status
              </label>
              <select
                id="edit-milestone-status"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="gc-select w-full"
              >
                {MILESTONE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s.replace('_', ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="gc-btn" onClick={() => setMilestoneModal(null)}>
                Cancel
              </button>
              <button type="submit" className="gc-btn gc-btn-primary" disabled={savingMilestone}>
                {savingMilestone ? 'Saving…' : 'Save status'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Stage 2.3 · reject milestone modal */}
      <Modal
        open={milestoneModal?.mode === 'reject'}
        onClose={() => setMilestoneModal(null)}
        title="Reject milestone"
      >
        {milestoneModal?.milestone && (
          <form onSubmit={handleRejectMilestone} className="space-y-4">
            <div>
              <p className="gc-eyebrow">Milestone</p>
              <p className="font-semibold">{milestoneModal.milestone.title}</p>
            </div>
            <div className="gc-field">
              <label htmlFor="reject-reason" className="gc-label">
                Reason (optional)
              </label>
              <textarea
                id="reject-reason"
                rows={3}
                value={reviewReason}
                onChange={(e) => setReviewReason(e.target.value)}
                className="gc-textarea"
                placeholder="Short reason for the rejection"
              />
              <p className="text-xs text-gray-500 mt-1">
                The full reason stays off-chain; only a short reference is written to the
                blockchain record.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="gc-btn"
                onClick={() => setMilestoneModal(null)}
              >
                Cancel
              </button>
              <button type="submit" className="gc-btn gc-btn-danger" disabled={savingMilestone}>
                {savingMilestone ? 'Rejecting…' : 'Reject milestone'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}