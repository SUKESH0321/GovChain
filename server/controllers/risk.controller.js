const projectModel = require('../models/project.model');
const tenderModel = require('../models/tender.model');
const milestoneModel = require('../models/milestone.model');
const paymentModel = require('../models/payment.model');
const riskService = require('../services/risk.service');
const pool = require('../config/db');
const { ROLES } = require('../utils/roles');

// GovChain — Stage 4.1 · AI risk & anomaly analysis.
//
// Read-only: the controller loads the records the other modules already own
// (through the existing models — no duplicate SQL) and hands them to
// services/risk.service.js. Nothing is written to PostgreSQL, nothing is sent
// to the blockchain, and the analysis is always calculated from the current
// database state.

// GET /api/projects/:projectId/risk-analysis
//
// Roles: officers and auditors get the full analysis of any project. A
// contractor may only analyse a project they are assigned to through a tender
// (the same rule the milestone and payment flows use), and only their own
// payments are fed to the engine, so another contractor's figures are never
// exposed.
async function getProjectRiskAnalysis(req, res) {
  try {
    const projectId = Number(req.params.projectId);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      return res.status(400).json({ message: 'Invalid project id' });
    }

    // 1. the project itself
    const project = await projectModel.findById(projectId);
    if (!project) {
      return res.status(404).json({ message: 'Project not found' });
    }

    // 2. the project's tenders (also the contractor access check)
    const tenders = await tenderModel.findAll(projectId);

    if (req.user.role === ROLES.CONTRACTOR) {
      const assigned = tenders.some((tender) => tender.contractor_id === req.user.id);
      if (!assigned) {
        return res
          .status(403)
          .json({ message: 'Access denied: contractor is not assigned to this project' });
      }
    }

    // 3. milestones and payments. Missing related rows are fine — the engine
    //    simply skips the signals that need them.
    const milestones = await milestoneModel.findByProject(projectId);
    const payments = await paymentModel.findAll({ projectId });

    const visiblePayments =
      req.user.role === ROLES.CONTRACTOR
        ? payments.filter((payment) => payment.contractor_id === req.user.id)
        : payments;

    // 4. analysis
    const riskAnalysis = riskService.analyzeProjectRisk({
      project,
      tenders,
      milestones,
      payments: visiblePayments,
    });

    return res.json({ riskAnalysis });
  } catch (error) {
    console.error(`[projects/risk-analysis] ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// GET /api/milestones/:milestoneId/risk-analysis
//
// Stage 4.2 · focused milestone risk analysis (§15). The engine runs over the
// milestone's whole project (so it is judged in context) and the controller
// returns only the signals that describe this milestone or its own payments,
// together with the milestone's payment figures.
//
// Roles: officers and auditors may analyse any milestone. A contractor may only
// analyse a milestone of a project whose tender is assigned to them — the same
// check the milestone lifecycle uses (milestoneModel.belongsToAssignedTender).
async function getMilestoneRiskAnalysis(req, res) {
  try {
    const milestoneId = Number(req.params.milestoneId);
    if (!Number.isInteger(milestoneId) || milestoneId <= 0) {
      return res.status(400).json({ message: 'Invalid milestone id' });
    }

    const milestone = await milestoneModel.findById(milestoneId);
    if (!milestone) {
      return res.status(404).json({ message: 'Milestone not found' });
    }

    if (req.user.role === ROLES.CONTRACTOR) {
      const assigned = await milestoneModel.belongsToAssignedTender(milestoneId, req.user.id);
      if (!assigned) {
        return res
          .status(403)
          .json({ message: 'Access denied: contractor is not assigned to this project' });
      }
    }

    // Milestones are listed with the project's tenders, and the payments of the
    // project are fetched once so the milestone rules see the real context.
    const [project, tenders] = await Promise.all([
      projectModel.findById(milestone.project_id),
      tenderModel.findAll(milestone.project_id),
    ]);
    const milestones = await milestoneModel.findByProject(milestone.project_id);
    const payments = await paymentModel.findAll({ projectId: milestone.project_id });

    const visiblePayments =
      req.user.role === ROLES.CONTRACTOR
        ? payments.filter((payment) => payment.contractor_id === req.user.id)
        : payments;

    const milestoneAnalysis = riskService.analyzeMilestoneRisk({
      project,
      tenders,
      milestones,
      payments: visiblePayments,
      milestoneId,
    });

    if (!milestoneAnalysis) {
      return res.status(404).json({ message: 'Milestone not found' });
    }

    return res.json({ milestoneAnalysis });
  } catch (error) {
    console.error(`[milestones/risk-analysis] ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

// GET /api/risk/summary — Stage 4.3 dashboard, one request for every project.
// Same analyzeProjectRisk engine as the per-project endpoint; only dashboard
// fields are returned. Read-only: nothing stored, nothing on the blockchain.
// Officers/auditors see every project; contractors only assigned ones with
// only their own payments analysed.
async function getRiskSummary(req, res) {
  try {
    const projects = await projectModel.findAll();

    let visibleProjects = projects;
    if (req.user.role === ROLES.CONTRACTOR) {
      const { rows } = await pool.query(
        'SELECT DISTINCT project_id FROM tenders WHERE contractor_id = $1',
        [req.user.id]
      );
      const assigned = new Set(rows.map((row) => row.project_id));
      visibleProjects = projects.filter((project) => assigned.has(project.id));
    }

    // Bulk-load relations once so the dashboard needs no per-project request.
    const [tenderRes, milestoneRes, allPayments] = await Promise.all([
      pool.query(
        'SELECT t.id, t.project_id, t.title, t.tender_amount, t.contractor_id, ' +
          'c.name AS contractor_name, t.status, t.created_at, t.updated_at ' +
          'FROM tenders t LEFT JOIN users c ON c.id = t.contractor_id'
      ),
      pool.query(
        'SELECT m.id, m.project_id, m.title, m.amount, m.due_date, m.status, ' +
          'm.created_at, m.updated_at FROM milestones m'
      ),
      paymentModel.findAll(),
    ]);

    const tenders = tenderRes.rows.map((row) => ({
      id: row.id,
      project_id: row.project_id,
      title: row.title,
      tender_amount: row.tender_amount !== null ? Number(row.tender_amount) : null,
      contractor_id: row.contractor_id,
      contractor_name: row.contractor_name,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    const milestones = milestoneRes.rows.map((row) => ({
      id: row.id,
      project_id: row.project_id,
      title: row.title,
      amount: row.amount !== null ? Number(row.amount) : null,
      due_date: row.due_date ? row.due_date.toISOString().slice(0, 10) : null,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    const tendersByProject = new Map();
    tenders.forEach((tender) => {
      if (!tendersByProject.has(tender.project_id)) tendersByProject.set(tender.project_id, []);
      tendersByProject.get(tender.project_id).push(tender);
    });
    const milestonesByProject = new Map();
    milestones.forEach((milestone) => {
      if (!milestonesByProject.has(milestone.project_id)) {
        milestonesByProject.set(milestone.project_id, []);
      }
      milestonesByProject.get(milestone.project_id).push(milestone);
    });
    const paymentsByProject = new Map();
    allPayments.forEach((payment) => {
      if (!paymentsByProject.has(payment.project_id)) paymentsByProject.set(payment.project_id, []);
      paymentsByProject.get(payment.project_id).push(payment);
    });

    const entries = visibleProjects.map((project) => {
      const projectTenders = tendersByProject.get(project.id) || [];
      const projectMilestones = milestonesByProject.get(project.id) || [];
      const projectPayments = paymentsByProject.get(project.id) || [];
      const scopedPayments =
        req.user.role === ROLES.CONTRACTOR
          ? projectPayments.filter((p) => p.contractor_id === req.user.id)
          : projectPayments;
      const analysis = riskService.analyzeProjectRisk({
        project,
        tenders: projectTenders,
        milestones: projectMilestones,
        payments: scopedPayments,
      });
      return {
        projectId: project.id,
        projectName: project.name,
        projectStatus: project.status,
        projectBudget: project.budget,
        riskLevel: analysis.riskLevel,
        riskScore: analysis.riskScore,
        signalCount: analysis.signalCount,
        scoreBreakdown: analysis.scoreBreakdown,
        topSeverity:
          (analysis.signals && analysis.signals.length > 0 && analysis.signals[0].severity) ||
          null,
        signals: analysis.signals,
      };
    });

    const summary = {
      totalProjects: entries.length,
      highRisk: entries.filter((e) => e.riskLevel === riskService.RISK_LEVELS.HIGH).length,
      mediumRisk: entries.filter((e) => e.riskLevel === riskService.RISK_LEVELS.MEDIUM).length,
      lowRisk: entries.filter((e) => e.riskLevel === riskService.RISK_LEVELS.LOW).length,
      requiringReview: entries.filter((e) => e.signalCount > 0).length,
    };

    return res.json({ summary, projects: entries, disclaimer: riskService.DISCLAIMER });
  } catch (error) {
    console.error(`[risk/summary] ${error.message}`);
    return res.status(500).json({ message: 'Internal server error' });
  }
}

module.exports = { getProjectRiskAnalysis, getMilestoneRiskAnalysis, getRiskSummary };
