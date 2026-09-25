// GovChain — Stage 4.1 · AI risk & anomaly engine.
// GovChain — Stage 4.2 · project / milestone / payment risk analysis.
//
// A deterministic, explainable rule engine: it reads the records the other
// GovChain modules already own (project, tenders, milestones, payments) and
// produces risk *indicators*.
//
// Rules of this MVP:
//   * local only — no external AI service, no ML pipeline, no training step;
//   * deterministic — the same database state always produces the same result
//     (no random values, no fabricated "confidence");
//   * explainable — every signal carries the exact numbers that triggered it;
//   * careful wording — a signal is a *potential anomaly that requires review*,
//     never a statement that fraud, corruption or wrongdoing occurred.
//
// Every rule lives in its own small function:
//   Stage 4.1 : analyzeTenderBudget, analyzePaymentWorkflow, analyzeTimeline
//   Stage 4.2 : analyzeMilestoneAllocation, analyzeMilestonePaymentRatio,
//               analyzeMultiplePayments, analyzeProgressVsPayment,
//               analyzeCumulativePayments, analyzeContractorConcentration
// The score is the capped sum of the signal weights (see calculateRiskScore),
// and signals that describe the same underlying fact are merged before scoring
// so one condition can never inflate the score twice (see dedupeSignals).

const RISK_LEVELS = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
});

// All thresholds live here, so the model can be tuned in one place. Ratios are
// multiples (1.1 = 110% of the baseline amount).
const RISK_THRESHOLDS = Object.freeze({
  // Tender value vs the sanctioned project budget.
  tenderBudgetHighRatio: 1.1, // flag a tender above 110% of the budget
  tenderBudgetHighSeverityRatio: 1.25, // escalate to HIGH at 125%
  tenderBudgetLowRatio: 0.4, // flag a tender below 40% of the budget

  // Milestone plan vs the sanctioned budget.
  milestoneTotalBudgetRatio: 1.0, // planned milestones should not exceed the budget
  milestoneTotalHighSeverityRatio: 1.25,

  // Payments vs the milestone they were requested against.
  paymentMilestoneHighRatio: 1.2, // flag a payment above 120% of the milestone amount
  paymentMilestoneHighSeverityRatio: 1.5, // escalate to HIGH at 150%
  paymentMilestoneTotalRatio: 1.2, // repeated payments above the milestone amount

  // Stage 4.2 · milestone allocation (§3). A single milestone may legitimately
  // cover a whole project when it is the only one, so the share rule only
  // applies when the project has at least two milestones.
  singleMilestoneBudgetShare: 0.6, // one milestone above 60% of the budget
  allocationTenderHighRatio: 1.1, // allocation above 110% of the awarded tender

  // Stage 4.2 · cumulative payment totals (§4). Committed = AUTHORIZED + RELEASED.
  cumulativeBudgetHighRatio: 1.0, // released money above the project budget
  cumulativeTenderHighRatio: 1.2, // committed money above 120% of the tender
  cumulativeAllocationHighRatio: 1.1, // released money above 110% of the allocation

  // Stage 4.2 · multiple payments for one milestone (§6).
  multiplePaymentsMinCount: 2, // at least this many non-rejected payments

  // Stage 4.2 · contractor concentration (§10).
  contractorTenderHighRatio: 1.1, // a contractor's payments above their tender value
  contractorTenderHighSeverityRatio: 1.25,
  contractorDominanceShare: 0.9, // one contractor holding this share of the payments

  // Risk score -> risk level cut-offs (see calculateRiskScore).
  mediumScore: 20,
  highScore: 60,
});

// Severity weights of the explainable scoring model: the risk score is the
// capped sum of the weights of every detected signal.
const SEVERITY_WEIGHTS = Object.freeze({ HIGH: 40, MEDIUM: 20, LOW: 8 });

// Order used when returning the signals: most severe first, then the order in
// which the rules were evaluated. That makes the list stable for a given
// database state (it never shuffles between reloads).
const SEVERITY_ORDER = Object.freeze({ HIGH: 0, MEDIUM: 1, LOW: 2 });

const DISCLAIMER =
  'Automated risk indicators derived from the GovChain records. A flagged ' +
  'signal is a potential anomaly that requires review — it is not proof of ' +
  'fraud, corruption or wrongdoing.';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Ratio rounded to three decimals, or null when the denominator is missing.
function ratioOf(numerator, denominator) {
  if (!denominator) {
    return null;
  }
  return Math.round((numerator / denominator) * 1000) / 1000;
}

// Day granularity (YYYY-MM-DD) or null. Dates that were never recorded are
// skipped by the caller — the engine never invents a value.
function dayOf(value) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

// Millisecond timestamp or null (used when both sides are real timestamps).
function msOf(value) {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

// Earliest / latest timestamp of the given values (ISO strings compare fine), or
// null when nothing was recorded — the engine never invents a timestamp.
function earliest(values) {
  const usable = (values || []).filter(Boolean);
  if (usable.length === 0) {
    return null;
  }
  return usable.reduce((min, value) => (String(value) < String(min) ? value : min));
}

function latest(values) {
  const usable = (values || []).filter(Boolean);
  if (usable.length === 0) {
    return null;
  }
  return usable.reduce((max, value) => (String(value) > String(max) ? value : max));
}

// Signal categories (used by the cross-entity risk summary of Stage 4.2).
const SIGNAL_CATEGORIES = Object.freeze({
  TENDER_BUDGET_ANOMALY: 'TENDER',
  MILESTONE_ALLOCATION_ANOMALY: 'MILESTONE',
  PAYMENT_MILESTONE_RATIO: 'PAYMENT',
  PAYMENT_CUMULATIVE_ANOMALY: 'PAYMENT',
  MULTIPLE_PAYMENT_MILESTONE: 'PAYMENT',
  PAYMENT_WORKFLOW_ANOMALY: 'PAYMENT',
  PROGRESS_PAYMENT_ANOMALY: 'MILESTONE',
  MILESTONE_TIMELINE_ANOMALY: 'TIMELINE',
  PAYMENT_TIMELINE_ANOMALY: 'TIMELINE',
  CONTRACTOR_CONCENTRATION: 'CONTRACTOR',
});

// Payment statuses that represent money on its way out. A rejected payment is
// never treated as a financial outflow.
const PAYMENT_STATUSES = Object.freeze(['REQUESTED', 'AUTHORIZED', 'RELEASED', 'REJECTED']);
const OUTFLOW_STATUSES = Object.freeze(['REQUESTED', 'AUTHORIZED', 'RELEASED']);

// A fact key names the underlying condition a signal describes. Two signals
// sharing a fact key are two views of the same fact: they are merged before
// scoring so the risk score is never inflated twice for one anomaly (§12).
function factKeyOf(type, evidence) {
  const entity =
    (evidence && (evidence.milestoneId !== undefined ? `milestone:${evidence.milestoneId}` : null)) ||
    (evidence && (evidence.paymentId !== undefined ? `payment:${evidence.paymentId}` : null)) ||
    (evidence && (evidence.contractorId !== undefined ? `contractor:${evidence.contractorId}` : null)) ||
    (evidence && (evidence.tenderId !== undefined ? `tender:${evidence.tenderId}` : null)) ||
    'project';

  const reason = evidence && evidence.reason ? `:${evidence.reason}` : '';
  const status = evidence && evidence.paymentStatus ? `:${evidence.paymentStatus}` : '';

  return `${type}:${entity}${status}${reason}`;
}

function makeSignal(type, severity, message, evidence, factKey) {
  return {
    type,
    category: SIGNAL_CATEGORIES[type] || 'PROJECT',
    severity,
    message,
    evidence,
    factKey: factKey || factKeyOf(type, evidence),
  };
}

function indexById(rows) {
  const map = new Map();
  (rows || []).forEach((row) => map.set(row.id, row));
  return map;
}

// { REQUESTED: n, AUTHORIZED: n, RELEASED: n, REJECTED: n } — every payment is
// counted in exactly one bucket (its current status), so the same money can
// never be totalled twice across statuses (§5, §12).
function emptyStatusTotals() {
  return { REQUESTED: 0, AUTHORIZED: 0, RELEASED: 0, REJECTED: 0 };
}

function sumPaymentsByStatus(payments) {
  const totals = emptyStatusTotals();
  (payments || []).forEach((payment) => {
    const amount = toNumber(payment.amount) || 0;
    if (Object.prototype.hasOwnProperty.call(totals, payment.status)) {
      totals[payment.status] += amount;
    }
  });
  return totals;
}

// "Money committed" = authorized (incl. already released) + released. A
// RELEASED payment is also an authorized one, so only AUTHORIZED and RELEASED
// are added here — never the same row twice.
function committedOf(totals) {
  return (totals.AUTHORIZED || 0) + (totals.RELEASED || 0);
}


// ---------------------------------------------------------------------------
// Signal A · budget / tender amount anomaly (§3, §7)
// project budget <-> tender amount
// ---------------------------------------------------------------------------

function analyzeTenderBudget(project, tenders) {
  const signals = [];
  const budget = toNumber(project && project.budget);

  if (!budget || budget <= 0 || !Array.isArray(tenders)) {
    return signals;
  }

  tenders.forEach((tender) => {
    const amount = toNumber(tender.tender_amount);
    if (!amount || amount <= 0) {
      return;
    }

    const ratio = ratioOf(amount, budget);

    if (ratio !== null && ratio >= RISK_THRESHOLDS.tenderBudgetHighRatio) {
      signals.push(
        makeSignal(
          'TENDER_BUDGET_ANOMALY',
          ratio >= RISK_THRESHOLDS.tenderBudgetHighSeverityRatio
            ? RISK_LEVELS.HIGH
            : RISK_LEVELS.MEDIUM,
          'Tender amount is significantly higher than the project budget. Potential anomaly — requires review.',
          {
            tenderId: tender.id,
            tenderTitle: tender.title,
            projectBudget: budget,
            tenderAmount: amount,
            ratio,
            threshold: RISK_THRESHOLDS.tenderBudgetHighRatio,
          }
        )
      );
    } else if (ratio !== null && ratio <= RISK_THRESHOLDS.tenderBudgetLowRatio) {
      signals.push(
        makeSignal(
          'TENDER_BUDGET_ANOMALY',
          RISK_LEVELS.LOW,
          'Tender amount is unusually low compared with the project budget — the scope may be under-costed. Risk indicator — requires review.',
          {
            tenderId: tender.id,
            tenderTitle: tender.title,
            projectBudget: budget,
            tenderAmount: amount,
            ratio,
            threshold: RISK_THRESHOLDS.tenderBudgetLowRatio,
          }
        )
      );
    }
  });

  return signals;
}

// ---------------------------------------------------------------------------
// Signal B · milestone allocation (§3, Stage 4.2)
// The sum of the planned milestones is compared with the sanctioned budget and
// with the awarded tender amount, and each milestone's share of the budget is
// checked. A plan that allocates more than the project is worth is flagged.
// ---------------------------------------------------------------------------

function analyzeMilestoneAllocation(project, milestones, tenders) {
  const signals = [];
  const budget = toNumber(project && project.budget);

  if (!budget || budget <= 0 || !Array.isArray(milestones) || milestones.length === 0) {
    return signals;
  }

  const values = milestones
    .map((milestone) => ({ milestone, amount: toNumber(milestone.amount) }))
    .filter((entry) => entry.amount && entry.amount > 0);

  if (values.length === 0) {
    return signals;
  }

  const total = values.reduce((sum, entry) => sum + entry.amount, 0);
  const totalRatio = ratioOf(total, budget);
  let budgetFlagged = false;

  if (totalRatio !== null && totalRatio > RISK_THRESHOLDS.milestoneTotalBudgetRatio) {
    budgetFlagged = true;
    signals.push(
      makeSignal(
        'MILESTONE_ALLOCATION_ANOMALY',
        totalRatio >= RISK_THRESHOLDS.milestoneTotalHighSeverityRatio
          ? RISK_LEVELS.HIGH
          : RISK_LEVELS.MEDIUM,
        'Total milestone allocation exceeds the project budget. Potential anomaly — requires review.',
        {
          projectBudget: budget,
          totalMilestoneAmount: total,
          milestoneCount: values.length,
          ratio: totalRatio,
          threshold: RISK_THRESHOLDS.milestoneTotalBudgetRatio,
        },
        // One project-level fact, so it is scored once whatever else is found.
        'MILESTONE_ALLOCATION_ANOMALY:allocation-exceeds-budget'
      )
    );
  }

  // The awarded tender is what the work was actually contracted for: a plan
  // allocating materially more than that is worth a look. Skipped while the
  // budget comparison already fired — both describe the same over-allocation, so
  // it is scored once (§12).
  const tenderTotal = (tenders || []).reduce(
    (sum, tender) => sum + (toNumber(tender.tender_amount) || 0),
    0
  );
  const tenderRatio = ratioOf(total, tenderTotal);

  if (!budgetFlagged && tenderRatio !== null && tenderRatio > RISK_THRESHOLDS.allocationTenderHighRatio) {
    signals.push(
      makeSignal(
        'MILESTONE_ALLOCATION_ANOMALY',
        RISK_LEVELS.MEDIUM,
        'The planned milestone value exceeds the awarded tender amount. Unusual financial relationship — requires review.',
        {
          tenderAmount: tenderTotal,
          totalMilestoneAmount: total,
          milestoneCount: values.length,
          ratio: tenderRatio,
          threshold: RISK_THRESHOLDS.allocationTenderHighRatio,
        },
        'MILESTONE_ALLOCATION_ANOMALY:allocation-exceeds-tender'
      )
    );
  }

  // A single milestone that carries most of the budget. Skipped for
  // single-milestone projects, where covering the whole budget is normal.
  if (values.length >= 2) {
    values.forEach((entry) => {
      const share = ratioOf(entry.amount, budget);
      if (share !== null && share >= RISK_THRESHOLDS.singleMilestoneBudgetShare) {
        signals.push(
          makeSignal(
            'MILESTONE_ALLOCATION_ANOMALY',
            RISK_LEVELS.MEDIUM,
            'A single milestone represents an unusually large portion of the project budget. Potential anomaly — requires review.',
            {
              milestoneId: entry.milestone.id,
              milestoneTitle: entry.milestone.title,
              milestoneAmount: entry.amount,
              projectBudget: budget,
              share,
              milestoneCount: values.length,
              threshold: RISK_THRESHOLDS.singleMilestoneBudgetShare,
            },
            `MILESTONE_ALLOCATION_ANOMALY:milestone:${entry.milestone.id}:budget-share`
          )
        );
      }
    });
  }

  return signals;
}

// ---------------------------------------------------------------------------
// Signal C · milestone payment ratio (§5, §4 — Stage 4.2)
// Payments are grouped per milestone and per *current* status (REQUESTED,
// AUTHORIZED, RELEASED). Because every payment sits in exactly one status, the
// three totals are disjoint: authorized money is never scored again because it
// was later released, and rejected money is never treated as an outflow.
// ---------------------------------------------------------------------------

function groupPaymentsByMilestone(payments) {
  const byMilestone = new Map();

  (payments || []).forEach((payment) => {
    const amount = toNumber(payment.amount);
    if (!amount || amount <= 0 || payment.milestone_id === null || payment.milestone_id === undefined) {
      return;
    }

    const entry =
      byMilestone.get(payment.milestone_id) ||
      { milestoneId: payment.milestone_id, payments: [], totals: emptyStatusTotals(), largest: null };

    entry.payments.push(payment);
    if (Object.prototype.hasOwnProperty.call(entry.totals, payment.status)) {
      entry.totals[payment.status] += amount;
    }
    if (!entry.largest || amount > entry.largest.amount) {
      entry.largest = { paymentId: payment.id, amount, status: payment.status };
    }

    byMilestone.set(payment.milestone_id, entry);
  });

  return byMilestone;
}

function analyzeMilestonePaymentRatio(milestones, payments) {
  const signals = [];

  if (!Array.isArray(payments) || payments.length === 0) {
    return signals;
  }

  const milestoneById = indexById(milestones);
  const byMilestone = groupPaymentsByMilestone(payments);

  byMilestone.forEach((entry) => {
    const milestone = milestoneById.get(entry.milestoneId);

    // A payment without a resolvable milestone is reported by the workflow rule.
    if (!milestone) {
      return;
    }

    const milestoneAmount = toNumber(milestone.amount);
    if (!milestoneAmount || milestoneAmount <= 0) {
      return;
    }

    // One signal per milestone and status: the highest severity for the same
    // milestone is the one that counts (see dedupeSignals).
    ['RELEASED', 'AUTHORIZED', 'REQUESTED'].forEach((status) => {
      const amount = entry.totals[status];
      const ratio = ratioOf(amount, milestoneAmount);

      if (!amount || ratio === null || ratio < RISK_THRESHOLDS.paymentMilestoneHighRatio) {
        return;
      }

      const severity =
        ratio >= RISK_THRESHOLDS.paymentMilestoneHighSeverityRatio
          ? RISK_LEVELS.HIGH
          : RISK_LEVELS.MEDIUM;

      const label = status === 'RELEASED' ? 'released' : status === 'AUTHORIZED' ? 'authorized' : 'requested';
      const count = entry.payments.filter((payment) => payment.status === status).length;

      signals.push(
        makeSignal(
          'PAYMENT_MILESTONE_RATIO',
          severity,
          `The ${label} payment amount is disproportionately high compared with the associated milestone amount. Potential anomaly — requires review.`,
          {
            milestoneId: milestone.id,
            milestoneTitle: milestone.title,
            milestoneStatus: milestone.status,
            milestoneAmount,
            paymentAmount: amount,
            paymentStatus: status,
            paymentCount: count,
            largestPaymentAmount: entry.largest ? entry.largest.amount : null,
            largestPaymentId: entry.largest ? entry.largest.paymentId : null,
            ratio,
            threshold: RISK_THRESHOLDS.paymentMilestoneHighRatio,
          },
          `PAYMENT_MILESTONE_RATIO:milestone:${milestone.id}:${status}`
        )
      );
    });
  });

  return signals;
}

// ---------------------------------------------------------------------------
// Signal C2 · multiple payments for one milestone (§6, Stage 4.2)
// Multiplicity alone is not suspicious — several payments can be perfectly
// legitimate. The engine only reports the state that genuinely needs a look:
// an open request left next to money that has already moved on the same
// milestone. The counts stay available as evidence on the ratio signals.
// ---------------------------------------------------------------------------

function analyzeMultiplePayments(milestones, payments) {
  const signals = [];

  if (!Array.isArray(payments) || payments.length === 0) {
    return signals;
  }

  const milestoneById = indexById(milestones);

  groupPaymentsByMilestone(payments).forEach((entry) => {
    const milestone = milestoneById.get(entry.milestoneId);
    if (!milestone) {
      return;
    }

    const active = entry.payments.filter((payment) => payment.status !== 'REJECTED');
    const released = active.filter((payment) => payment.status === 'RELEASED').length;
    const authorized = active.filter((payment) => payment.status === 'AUTHORIZED').length;
    const requested = active.filter((payment) => payment.status === 'REQUESTED').length;

    if (active.length < RISK_THRESHOLDS.multiplePaymentsMinCount) {
      return;
    }
    if (released + authorized === 0 || requested === 0) {
      return;
    }

    signals.push(
      makeSignal(
        'MULTIPLE_PAYMENT_MILESTONE',
        RISK_LEVELS.LOW,
        'An open payment request still exists for a milestone that already carries decided payments. Workflow inconsistency — requires review.',
        {
          milestoneId: milestone.id,
          milestoneTitle: milestone.title,
          milestoneAmount: toNumber(milestone.amount),
          paymentCount: active.length,
          requestedCount: requested,
          authorizedCount: authorized,
          releasedCount: released,
          paymentsTotal: OUTFLOW_STATUSES.reduce((sum, status) => sum + entry.totals[status], 0),
        },
        `MULTIPLE_PAYMENT_MILESTONE:milestone:${milestone.id}`
      )
    );
  });

  return signals;
}

// ---------------------------------------------------------------------------
// Signal C3 · milestone progress vs payment (§8, Stage 4.2)
// Money that has already left the treasury on a milestone that has not reached
// verification is a workflow inconsistency; a verified/completed milestone
// without any payment is the reverse and stays informational.
// ---------------------------------------------------------------------------

function analyzeProgressVsPayment(milestones, payments) {
  const signals = [];

  if (!Array.isArray(milestones) || milestones.length === 0) {
    return signals;
  }

  const byMilestone = groupPaymentsByMilestone(payments || []);

  milestones.forEach((milestone) => {
    const entry = byMilestone.get(milestone.id);
    const totals = entry ? entry.totals : emptyStatusTotals();

    // (a) released money on a milestone that never reached verification.
    if ((milestone.status === 'PENDING' || milestone.status === 'IN_PROGRESS') && totals.RELEASED > 0) {
      signals.push(
        makeSignal(
          'PROGRESS_PAYMENT_ANOMALY',
          RISK_LEVELS.MEDIUM,
          `A ${milestone.status.replace('_', ' ').toLowerCase()} milestone already carries released payments. Workflow inconsistency — requires review.`,
          {
            milestoneId: milestone.id,
            milestoneTitle: milestone.title,
            milestoneStatus: milestone.status,
            milestoneAmount: toNumber(milestone.amount),
            paymentAmount: totals.RELEASED,
            paymentStatus: 'RELEASED',
          },
          `PROGRESS_PAYMENT_ANOMALY:milestone:${milestone.id}:released-before-verification`
        )
      );
    }

    // (b) a verified / completed milestone with no payment record at all.
    if (
      (milestone.status === 'VERIFIED' || milestone.status === 'COMPLETED') &&
      entry === undefined
    ) {
      signals.push(
        makeSignal(
          'PROGRESS_PAYMENT_ANOMALY',
          RISK_LEVELS.LOW,
          `A ${milestone.status.toLowerCase()} milestone has no payment record. Informational — confirm whether a payment is still pending.`,
          {
            milestoneId: milestone.id,
            milestoneTitle: milestone.title,
            milestoneStatus: milestone.status,
            milestoneAmount: toNumber(milestone.amount),
          },
          `PROGRESS_PAYMENT_ANOMALY:milestone:${milestone.id}:no-payment`
        )
      );
    }
  });

  return signals;
}


// ---------------------------------------------------------------------------
// Signal C4 · cumulative payment analysis (§4, Stage 4.2)
// Project-level totals against the budget, the awarded tender and the planned
// milestone allocation. Two guards keep the score honest (§12):
//   * released money is never reported again as "committed" — the released
//     total is the stronger fact, so the committed comparison is skipped once
//     the released one already fired;
//   * the allocation comparison is skipped while the allocation itself is
//     flagged (the wrong allocation is then the fact under review, not the
//     payments that follow from it).
// ---------------------------------------------------------------------------

function analyzeCumulativePayments(project, tenders, milestones, payments, context) {
  const signals = [];
  const budget = toNumber(project && project.budget);
  const totals = sumPaymentsByStatus(payments);
  const released = totals.RELEASED;
  const committed = committedOf(totals);

  if (!budget || budget <= 0 || committed <= 0) {
    return signals;
  }

  const releasedRatio = ratioOf(released, budget);

  if (released > 0 && releasedRatio !== null && releasedRatio >= RISK_THRESHOLDS.cumulativeBudgetHighRatio) {
    signals.push(
      makeSignal(
        'PAYMENT_CUMULATIVE_ANOMALY',
        RISK_LEVELS.HIGH,
        'Total released payments exceed the project budget. Potential anomaly — requires review.',
        {
          projectBudget: budget,
          paymentsTotal: released,
          paymentStatus: 'RELEASED',
          ratio: releasedRatio,
          threshold: RISK_THRESHOLDS.cumulativeBudgetHighRatio,
        },
        'PAYMENT_CUMULATIVE_ANOMALY:released-exceeds-budget'
      )
    );
  } else if (released === 0) {
    const committedRatio = ratioOf(committed, budget);
    if (committedRatio !== null && committedRatio >= RISK_THRESHOLDS.cumulativeBudgetHighRatio) {
      signals.push(
        makeSignal(
          'PAYMENT_CUMULATIVE_ANOMALY',
          RISK_LEVELS.MEDIUM,
          'Total authorized payments exceed the project budget. Potential anomaly — requires review.',
          {
            projectBudget: budget,
            paymentsTotal: committed,
            paymentStatus: 'AUTHORIZED',
            ratio: committedRatio,
            threshold: RISK_THRESHOLDS.cumulativeBudgetHighRatio,
          },
          'PAYMENT_CUMULATIVE_ANOMALY:committed-exceeds-budget'
        )
      );
    }
  }

  const tenderTotal = (tenders || []).reduce(
    (sum, tender) => sum + (toNumber(tender.tender_amount) || 0),
    0
  );
  const tenderRatio = ratioOf(committed, tenderTotal);

  if (tenderRatio !== null && tenderRatio >= RISK_THRESHOLDS.cumulativeTenderHighRatio) {
    signals.push(
      makeSignal(
        'PAYMENT_CUMULATIVE_ANOMALY',
        RISK_LEVELS.MEDIUM,
        'Total authorized and released payments exceed the awarded tender amount. Unusual financial relationship — requires review.',
        {
          tenderAmount: tenderTotal,
          paymentsTotal: committed,
          releasedTotal: released,
          ratio: tenderRatio,
          threshold: RISK_THRESHOLDS.cumulativeTenderHighRatio,
        },
        'PAYMENT_CUMULATIVE_ANOMALY:committed-exceeds-tender'
      )
    );
  }

  const allocation = (milestones || []).reduce(
    (sum, milestone) => sum + (toNumber(milestone.amount) || 0),
    0
  );
  const allocationRatio = ratioOf(released, allocation);

  if (released > 0 && allocationRatio !== null && allocationRatio >= RISK_THRESHOLDS.cumulativeAllocationHighRatio) {
    if (context && context.allocationFlagged) {
      // Already flagged through the allocation itself — recorded, not scored.
      context.suppressed.push({
        rule: 'CUMULATIVE_RELEASED_VS_ALLOCATION',
        reason:
          'The milestone allocation itself is already flagged, so it is not used again as the baseline.',
        releasedTotal: released,
        totalMilestoneAmount: allocation,
        ratio: allocationRatio,
      });
    } else {
      signals.push(
        makeSignal(
          'PAYMENT_CUMULATIVE_ANOMALY',
          RISK_LEVELS.MEDIUM,
          'Total released payments exceed the planned milestone allocation. Unusual financial relationship — requires review.',
          {
            totalMilestoneAmount: allocation,
            paymentsTotal: released,
            paymentStatus: 'RELEASED',
            ratio: allocationRatio,
            threshold: RISK_THRESHOLDS.cumulativeAllocationHighRatio,
          },
          'PAYMENT_CUMULATIVE_ANOMALY:released-exceeds-allocation'
        )
      );
    }
  }

  return signals;
}



// ---------------------------------------------------------------------------
// Signal D · payment / milestone workflow anomaly (§5)
// Analysis only — the engine never changes or bypasses the existing payment
// workflow, it just reports workflow states that deserve a look.
// ---------------------------------------------------------------------------

function analyzePaymentWorkflow(milestones, payments) {
  const signals = [];

  if (!Array.isArray(payments) || payments.length === 0) {
    return signals;
  }

  // A payment may only be requested for a VERIFIED milestone. The engine marks
  // the workflow states that contradict that rule: a milestone that never
  // reached verification, and a milestone that was rejected again. The states
  // that legitimately follow a payment (VERIFIED, COMPLETED) are not flagged,
  // and neither is the ambiguous SUBMITTED rework state.
  const neverVerifiedStates = new Set(['PENDING', 'IN_PROGRESS']);

  const milestoneById = indexById(milestones);

  payments.forEach((payment) => {
    const milestone = milestoneById.get(payment.milestone_id);

    // (a) the referenced milestone is not part of this project (or has been
    //     removed) while the payment record still references it.
    if (!milestone) {
      signals.push(
        makeSignal(
          'PAYMENT_WORKFLOW_ANOMALY',
          RISK_LEVELS.HIGH,
          'A payment references a milestone that is not part of this project. Potential anomaly — requires review.',
          {
            paymentId: payment.id,
            paymentStatus: payment.status,
            milestoneId: payment.milestone_id,
            reason: 'MILESTONE_NOT_IN_PROJECT',
          }
        )
      );
      return;
    }

    // (b) a payment for a milestone that never reached verification — the
    //     milestone lifecycle (PENDING -> IN_PROGRESS -> SUBMITTED -> VERIFIED)
    //     was left behind, so the payment cannot be traced back to a verified
    //     milestone in the current records.
    if (payment.status !== 'REJECTED' && neverVerifiedStates.has(milestone.status)) {
      signals.push(
        makeSignal(
          'PAYMENT_WORKFLOW_ANOMALY',
          RISK_LEVELS.MEDIUM,
          'A payment exists for a milestone that has not reached verification. Risk indicator — requires review.',
          {
            paymentId: payment.id,
            paymentStatus: payment.status,
            milestoneId: milestone.id,
            milestoneTitle: milestone.title,
            milestoneStatus: milestone.status,
            reason: 'PAYMENT_ON_UNVERIFIED_MILESTONE',
          }
        )
      );
    }

    // (c) a milestone that was rejected again while an open payment decision
    //     still exists for it.
    if (payment.status !== 'REJECTED' && milestone.status === 'REJECTED') {
      signals.push(
        makeSignal(
          'PAYMENT_WORKFLOW_ANOMALY',
          RISK_LEVELS.HIGH,
          'A payment is recorded against a rejected milestone. Potential anomaly — requires review.',
          {
            paymentId: payment.id,
            paymentStatus: payment.status,
            milestoneId: milestone.id,
            milestoneTitle: milestone.title,
            milestoneStatus: milestone.status,
            reason: 'PAYMENT_ON_REJECTED_MILESTONE',
          }
        )
      );
    }

    // (d) authorized/released money without a recorded authorization stamp.
    if ((payment.status === 'AUTHORIZED' || payment.status === 'RELEASED') && !payment.authorized_at) {
      signals.push(
        makeSignal(
          'PAYMENT_WORKFLOW_ANOMALY',
          RISK_LEVELS.HIGH,
          'A payment is authorized or released without a recorded authorization timestamp. Potential anomaly — requires review.',
          {
            paymentId: payment.id,
            paymentStatus: payment.status,
            reason: 'AUTHORIZATION_STAMP_MISSING',
          }
        )
      );
    }

    // (e) released money without a recorded release stamp.
    if (payment.status === 'RELEASED' && !payment.released_at) {
      signals.push(
        makeSignal(
          'PAYMENT_WORKFLOW_ANOMALY',
          RISK_LEVELS.MEDIUM,
          'A payment is marked released without a recorded release timestamp. Risk indicator — requires review.',
          {
            paymentId: payment.id,
            paymentStatus: payment.status,
            reason: 'RELEASE_STAMP_MISSING',
          }
        )
      );
    }

    // (f) timestamps that do not follow the workflow order.
    const requestedMs = msOf(payment.requested_at);
    const authorizedMs = msOf(payment.authorized_at);
    const releasedMs = msOf(payment.released_at);

    if (requestedMs !== null && authorizedMs !== null && authorizedMs < requestedMs) {
      signals.push(
        makeSignal(
          'PAYMENT_WORKFLOW_ANOMALY',
          RISK_LEVELS.HIGH,
          'A payment was authorized before it was requested. Potential anomaly — requires review.',
          {
            paymentId: payment.id,
            paymentStatus: payment.status,
            reason: 'AUTHORIZED_BEFORE_REQUESTED',
            requestedAt: payment.requested_at,
            authorizedAt: payment.authorized_at,
          }
        )
      );
    }

    if (releasedMs !== null && authorizedMs !== null && releasedMs < authorizedMs) {
      signals.push(
        makeSignal(
          'PAYMENT_WORKFLOW_ANOMALY',
          RISK_LEVELS.HIGH,
          'A payment was released before it was authorized. Potential anomaly — requires review.',
          {
            paymentId: payment.id,
            paymentStatus: payment.status,
            reason: 'RELEASED_BEFORE_AUTHORIZED',
            authorizedAt: payment.authorized_at,
            releasedAt: payment.released_at,
          }
        )
      );
    }

    // (g) money marked as authorized without a recorded authorizing officer.
    //     Stage 4.2 · payment state consistency (§7).
    if (
      (payment.status === 'AUTHORIZED' || payment.status === 'RELEASED') &&
      !payment.authorized_by
    ) {
      signals.push(
        makeSignal(
          'PAYMENT_WORKFLOW_ANOMALY',
          RISK_LEVELS.HIGH,
          'A payment is authorized or released without a recorded authorizing officer. Potential anomaly — requires review.',
          {
            paymentId: payment.id,
            paymentStatus: payment.status,
            reason: 'AUTHORIZATION_ACTOR_MISSING',
          }
        )
      );
    }

    // (h) released money without a recorded releasing officer.
    if (payment.status === 'RELEASED' && !payment.released_by) {
      signals.push(
        makeSignal(
          'PAYMENT_WORKFLOW_ANOMALY',
          RISK_LEVELS.MEDIUM,
          'A payment is marked released without a recorded releasing officer. Risk indicator — requires review.',
          {
            paymentId: payment.id,
            paymentStatus: payment.status,
            reason: 'RELEASE_ACTOR_MISSING',
          }
        )
      );
    }
  });

  return signals;
}

// ---------------------------------------------------------------------------
// Signal F · contractor concentration (§10, Stage 4.2)
// Payments grouped per contractor and compared with the tender that contractor
// holds. A large legitimate contract is *not* a signal on its own: only a
// payment total above that contractor's own tender value, or one contractor
// holding almost every payment of a project that paid several contractors, is
// reported — always with the numbers that produced it.
// ---------------------------------------------------------------------------

function groupPaymentsByContractor(payments) {
  const byContractor = new Map();

  (payments || []).forEach((payment) => {
    if (payment.contractor_id === null || payment.contractor_id === undefined) {
      return;
    }
    if (!OUTFLOW_STATUSES.includes(payment.status)) {
      return;
    }

    const entry =
      byContractor.get(payment.contractor_id) ||
      {
        contractorId: payment.contractor_id,
        contractorName: payment.contractor_name || null,
        tenderAmount: 0,
        totals: emptyStatusTotals(),
      };

    entry.totals[payment.status] += toNumber(payment.amount) || 0;
    byContractor.set(payment.contractor_id, entry);
  });

  return byContractor;
}

function analyzeContractorConcentration(project, tenders, payments) {
  const signals = [];
  const budget = toNumber(project && project.budget);
  const byContractor = groupPaymentsByContractor(payments);

  if (byContractor.size === 0) {
    return signals;
  }

  let totalCommitted = 0;
  byContractor.forEach((entry) => {
    totalCommitted += committedOf(entry.totals);
  });

  const tenderByContractor = new Map();
  (tenders || []).forEach((tender) => {
    if (tender.contractor_id === null || tender.contractor_id === undefined) {
      return;
    }
    tenderByContractor.set(
      tender.contractor_id,
      (tenderByContractor.get(tender.contractor_id) || 0) + (toNumber(tender.tender_amount) || 0)
    );
  });

  byContractor.forEach((entry) => {
    const committed = committedOf(entry.totals);
    if (committed <= 0) {
      return;
    }

    const tenderAmount = tenderByContractor.get(entry.contractorId) || 0;
    const ratio = ratioOf(committed, tenderAmount);

    // (a) paid more than the work this contractor was awarded.
    if (tenderAmount > 0 && ratio !== null && ratio >= RISK_THRESHOLDS.contractorTenderHighRatio) {
      signals.push(
        makeSignal(
          'CONTRACTOR_CONCENTRATION',
          ratio >= RISK_THRESHOLDS.contractorTenderHighSeverityRatio
            ? RISK_LEVELS.HIGH
            : RISK_LEVELS.MEDIUM,
          "A contractor's authorized and released payments exceed the tender amount awarded to them. Unusual financial relationship — requires review.",
          {
            contractorId: entry.contractorId,
            contractorName: entry.contractorName,
            contractorTenderAmount: tenderAmount,
            contractorCommit: committed,
            contractorReleased: entry.totals.RELEASED,
            projectBudget: budget,
            ratio,
            threshold: RISK_THRESHOLDS.contractorTenderHighRatio,
          },
          `CONTRACTOR_CONCENTRATION:contractor:${entry.contractorId}:payments-exceed-tender`
        )
      );
    }

    // (b) one contractor holding almost every payment of a project that paid
    //     more than one contractor. Informational — a single supplier is normal.
    const share = ratioOf(committed, totalCommitted);
    if (byContractor.size > 1 && share !== null && share >= RISK_THRESHOLDS.contractorDominanceShare) {
      signals.push(
        makeSignal(
          'CONTRACTOR_CONCENTRATION',
          RISK_LEVELS.LOW,
          'One contractor holds almost all payments of a project that paid more than one contractor. Risk indicator — requires review.',
          {
            contractorId: entry.contractorId,
            contractorName: entry.contractorName,
            contractorCommit: committed,
            paymentsTotal: totalCommitted,
            contractorCount: byContractor.size,
            share,
            threshold: RISK_THRESHOLDS.contractorDominanceShare,
          },
          `CONTRACTOR_CONCENTRATION:contractor:${entry.contractorId}:share`
        )
      );
    }
  });

  return signals;
}


// ---------------------------------------------------------------------------
// §2 / §11 · financial summary
// Aggregate values derived only from the rows that exist. Nothing is stored, and
// nothing is estimated: a missing budget simply stays null.
// ---------------------------------------------------------------------------

function summarizeFinancials(project, tenders, milestones, payments) {
  const budget = toNumber(project && project.budget);
  const tenderAmount = (tenders || []).reduce(
    (sum, tender) => sum + (toNumber(tender.tender_amount) || 0),
    0
  );
  const totalMilestoneAmount = (milestones || []).reduce(
    (sum, milestone) => sum + (toNumber(milestone.amount) || 0),
    0
  );
  const totals = sumPaymentsByStatus(payments);
  const committed = committedOf(totals);

  const byContractor = groupPaymentsByContractor(payments);
  (tenders || []).forEach((tender) => {
    if (tender.contractor_id === null || tender.contractor_id === undefined) {
      return;
    }
    const entry = byContractor.get(tender.contractor_id);
    if (entry) {
      entry.tenderAmount += toNumber(tender.tender_amount) || 0;
    }
  });

  const contractors = [...byContractor.values()]
    .map((entry) => {
      const entryCommitted = committedOf(entry.totals);
      return {
        contractorId: entry.contractorId,
        contractorName: entry.contractorName,
        tenderAmount: entry.tenderAmount || null,
        requested: entry.totals.REQUESTED,
        authorized: entry.totals.AUTHORIZED,
        released: entry.totals.RELEASED,
        committed: entryCommitted,
        shareOfPayments: ratioOf(entryCommitted, committed),
        shareOfBudget: ratioOf(entryCommitted, budget),
      };
    })
    .sort((a, b) => b.committed - a.committed);

  return {
    projectBudget: budget,
    tenderAmount: tenderAmount || null,
    tenderCount: (tenders || []).length,
    totalMilestoneAmount,
    milestoneCount: (milestones || []).length,
    totalRequestedPayments: totals.REQUESTED,
    totalAuthorizedPayments: totals.AUTHORIZED,
    totalReleasedPayments: totals.RELEASED,
    totalRejectedPayments: totals.REJECTED,
    totalCommittedPayments: committed,
    totalPaymentRecords: (payments || []).length,
    // Budget still available once authorized and released money is accounted for.
    remainingProjectBudget: budget ? Math.round((budget - committed) * 100) / 100 : null,
    // Budget still available once only the released money is accounted for.
    remainingAfterReleased: budget ? Math.round((budget - totals.RELEASED) * 100) / 100 : null,
    releasedAgainstBudget: ratioOf(totals.RELEASED, budget),
    committedAgainstBudget: ratioOf(committed, budget),
    allocationAgainstBudget: ratioOf(totalMilestoneAmount, budget),
    paymentsAgainstTender: ratioOf(committed, tenderAmount),
    contractors,
  };
}



// ---------------------------------------------------------------------------
// Signal E · milestone timeline anomaly (§6)
// Only real dates are compared. Whatever was not recorded is skipped — the
// engine never invents a date.
// ---------------------------------------------------------------------------

function analyzeTimeline(project, milestones, payments) {
  const signals = [];

  const projectStart = dayOf(project && project.start_date);
  const projectEnd = dayOf(project && project.end_date);

  if (Array.isArray(milestones)) {
    milestones.forEach((milestone) => {
      const due = dayOf(milestone.due_date);
      const created = dayOf(milestone.created_at);

      // (a) a milestone due after the project deadline.
      if (due && projectEnd && due > projectEnd) {
        signals.push(
          makeSignal(
            'MILESTONE_TIMELINE_ANOMALY',
            RISK_LEVELS.MEDIUM,
            'A milestone is due after the project deadline. Risk indicator — requires review.',
            {
              milestoneId: milestone.id,
              milestoneTitle: milestone.title,
              milestoneDueDate: due,
              projectEndDate: projectEnd,
              reason: 'DUE_AFTER_PROJECT_END',
            }
          )
        );
      }

      // (b) a milestone due before the project even starts.
      if (due && projectStart && due < projectStart) {
        signals.push(
          makeSignal(
            'MILESTONE_TIMELINE_ANOMALY',
            RISK_LEVELS.MEDIUM,
            'A milestone is due before the project start date. Risk indicator — requires review.',
            {
              milestoneId: milestone.id,
              milestoneTitle: milestone.title,
              milestoneDueDate: due,
              projectStartDate: projectStart,
              reason: 'DUE_BEFORE_PROJECT_START',
            }
          )
        );
      }

      // (c) the milestone record itself sits outside the project timeline.
      if (created && projectEnd && created > projectEnd) {
        signals.push(
          makeSignal(
            'MILESTONE_TIMELINE_ANOMALY',
            RISK_LEVELS.LOW,
            'A milestone was recorded after the project deadline. Risk indicator — requires review.',
            {
              milestoneId: milestone.id,
              milestoneTitle: milestone.title,
              milestoneCreated: created,
              projectEndDate: projectEnd,
              reason: 'CREATED_AFTER_PROJECT_END',
            }
          )
        );
      }
    });
  }

  // (d) payments cannot precede the project, nor the milestone they pay for.
  if (Array.isArray(payments)) {
    const milestoneById = indexById(milestones);

    payments.forEach((payment) => {
      const requested = dayOf(payment.requested_at);

      if (requested && projectStart && requested < projectStart) {
        signals.push(
          makeSignal(
            'PAYMENT_TIMELINE_ANOMALY',
            RISK_LEVELS.HIGH,
            'A payment was requested before the project start date. Potential anomaly — requires review.',
            {
              paymentId: payment.id,
              paymentStatus: payment.status,
              requestedAt: payment.requested_at,
              projectStartDate: projectStart,
              reason: 'PAYMENT_BEFORE_PROJECT_START',
            }
          )
        );
      }

      // Stage 4.2 · a payment recorded before the milestone it pays for exists.
      const milestone = milestoneById.get(payment.milestone_id);
      const milestoneCreated = milestone ? dayOf(milestone.created_at) : null;

      if (requested && milestoneCreated && requested < milestoneCreated) {
        signals.push(
          makeSignal(
            'PAYMENT_TIMELINE_ANOMALY',
            RISK_LEVELS.MEDIUM,
            'A payment was requested before the milestone it pays for was recorded. Risk indicator — requires review.',
            {
              paymentId: payment.id,
              paymentStatus: payment.status,
              requestedAt: payment.requested_at,
              milestoneId: milestone.id,
              milestoneTitle: milestone.title,
              milestoneCreated,
              reason: 'PAYMENT_BEFORE_MILESTONE',
            }
          )
        );
      }
    });
  }
  return signals;
}

// ---------------------------------------------------------------------------
// §8 · explainable risk score
// The score is the capped sum of the weights of the detected signals:
// HIGH = 40, MEDIUM = 20, LOW = 8 (see SEVERITY_WEIGHTS). The level is derived
// from the score with the cut-offs in RISK_THRESHOLDS. No random value and no
// hidden model are involved — the same records always produce the same score,
// and `scoreBreakdown` shows exactly how it was reached.
// ---------------------------------------------------------------------------

function calculateRiskScore(signals) {
  let rawScore = 0;
  const bySeverity = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  const byCategory = { TENDER: 0, MILESTONE: 0, PAYMENT: 0, TIMELINE: 0, CONTRACTOR: 0, PROJECT: 0 };
  const byType = {};

  signals.forEach((signal) => {
    bySeverity[signal.severity] = (bySeverity[signal.severity] || 0) + 1;
    byCategory[signal.category] = (byCategory[signal.category] || 0) + 1;
    byType[signal.type] = (byType[signal.type] || 0) + 1;
    rawScore += SEVERITY_WEIGHTS[signal.severity] || 0;
  });

  const riskScore = Math.min(100, rawScore);

  let riskLevel = RISK_LEVELS.LOW;
  if (riskScore >= RISK_THRESHOLDS.highScore) {
    riskLevel = RISK_LEVELS.HIGH;
  } else if (riskScore >= RISK_THRESHOLDS.mediumScore) {
    riskLevel = RISK_LEVELS.MEDIUM;
  }

  return {
    riskLevel,
    riskScore,
    scoreBreakdown: {
      signals: signals.length,
      bySeverity,
      byCategory,
      byType,
      weights: { HIGH: SEVERITY_WEIGHTS.HIGH, MEDIUM: SEVERITY_WEIGHTS.MEDIUM, LOW: SEVERITY_WEIGHTS.LOW },
      rawScore,
      capped: rawScore !== riskScore,
      levels: { mediumScore: RISK_THRESHOLDS.mediumScore, highScore: RISK_THRESHOLDS.highScore },
    },
  };
}

// ---------------------------------------------------------------------------
// §12 · order + de-duplication
// ---------------------------------------------------------------------------

// Most severe first, then the order in which the rules were evaluated — stable
// for a given database state.
function sortSignals(signals) {
  return signals
    .map((signal, index) => ({ signal, index }))
    .sort((a, b) => {
      const severity = SEVERITY_ORDER[a.signal.severity] - SEVERITY_ORDER[b.signal.severity];
      return severity !== 0 ? severity : a.index - b.index;
    })
    .map((entry) => entry.signal);
}

// Signals that describe the same fact (same `factKey`) are merged: the most
// severe one is scored and carries the others as `relatedSignals`. This is what
// keeps the score explainable — one anomaly can never add its weight twice, no
// matter how many rules noticed it.
function dedupeSignals(signals) {
  const byFact = new Map();
  const merged = [];

  sortSignals(signals).forEach((signal) => {
    const kept = byFact.get(signal.factKey);

    if (!kept) {
      byFact.set(signal.factKey, { ...signal, relatedSignals: [] });
      return;
    }

    kept.relatedSignals.push({
      type: signal.type,
      severity: signal.severity,
      message: signal.message,
      reason: (signal.evidence && signal.evidence.reason) || null,
    });

    merged.push({
      factKey: signal.factKey,
      keptType: kept.type,
      keptSeverity: kept.severity,
      droppedType: signal.type,
      droppedSeverity: signal.severity,
    });
  });

  return { signals: [...byFact.values()], merged };
}

// Blocking signals are workflow states the application itself would have
// refused; they alone already justify a HIGH assessment.
const BLOCKING_SIGNAL_REASONS = new Set([
  'MILESTONE_NOT_IN_PROJECT',
  'PAYMENT_ON_REJECTED_MILESTONE',
  'AUTHORIZATION_STAMP_MISSING',
  'AUTHORIZATION_ACTOR_MISSING',
  'AUTHORIZED_BEFORE_REQUESTED',
  'RELEASED_BEFORE_AUTHORIZED',
  'PAYMENT_BEFORE_PROJECT_START',
  'PAYMENT_BEFORE_MILESTONE',
]);

function hasBlockingSignal(signals) {
  return signals.some(
    (signal) => signal.evidence && BLOCKING_SIGNAL_REASONS.has(signal.evidence.reason)
  );
}

// ---------------------------------------------------------------------------
// Main entry points
// ---------------------------------------------------------------------------

// Shared post-processing: merge signals that describe the same fact, score the
// result and let a blocking workflow anomaly force a HIGH assessment. `extra`
// may add fields to the score breakdown (e.g. the suppressed comparisons).
function finalizeRisk(signals, extra) {
  const { signals: deduped, merged } = dedupeSignals(signals);
  const score = calculateRiskScore(deduped);
  const blocking = hasBlockingSignal(deduped);

  return {
    ...score,
    riskLevel: blocking ? RISK_LEVELS.HIGH : score.riskLevel,
    scoreBreakdown: {
      ...score.scoreBreakdown,
      mergedSignals: merged.length,
      merged,
      blockingSignal: blocking,
      ...((extra && extra.scoreBreakdown) || {}),
    },
    signals: deduped,
    signalCount: deduped.length,
    disclaimer: DISCLAIMER,
    thresholds: RISK_THRESHOLDS,
  };
}

// analyzeProjectRisk({ project, tenders, milestones, payments }) -> risk result.
//
// Every input is optional apart from the project; missing related records simply
// produce no signal (no invented values, no crash). The result is deterministic
// and explains itself through `summary`, `signals` and `scoreBreakdown`.
function analyzeProjectRisk({ project, tenders = [], milestones = [], payments = [] } = {}) {
  const analyzed = {
    tenders: Array.isArray(tenders) ? tenders.length : 0,
    milestones: Array.isArray(milestones) ? milestones.length : 0,
    payments: Array.isArray(payments) ? payments.length : 0,
    budget: project ? toNumber(project.budget) : null,
    projectStartDate: (project && project.start_date) || null,
    projectEndDate: (project && project.end_date) || null,
  };

  if (!project) {
    return {
      ...finalizeRisk([], null),
      signals: [],
      signalCount: 0,
      summary: summarizeFinancials(null, [], [], []),
      analyzed,
    };
  }

  // `context` collects the cross-rule information needed to avoid scoring the
  // same underlying condition twice (§12).
  const context = { allocationFlagged: false, suppressed: [] };

  const allocationSignals = analyzeMilestoneAllocation(project, milestones, tenders);
  context.allocationFlagged = allocationSignals.some(
    (signal) => signal.factKey === 'MILESTONE_ALLOCATION_ANOMALY:allocation-exceeds-budget'
  );

  const signals = [
    ...analyzeTenderBudget(project, tenders),
    ...allocationSignals,
    ...analyzeMilestonePaymentRatio(milestones, payments),
    ...analyzeMultiplePayments(milestones, payments),
    ...analyzeProgressVsPayment(milestones, payments),
    ...analyzeCumulativePayments(project, tenders, milestones, payments, context),
    ...analyzePaymentWorkflow(milestones, payments),
    ...analyzeContractorConcentration(project, tenders, payments),
    ...analyzeTimeline(project, milestones, payments),
  ];

  return {
    ...finalizeRisk(signals, { scoreBreakdown: { suppressed: context.suppressed } }),
    summary: summarizeFinancials(project, tenders, milestones, payments),
    analyzed,
  };
}

// analyzeMilestoneRisk({ project, tenders, milestones, payments, milestoneId })
//   -> focused milestone risk result (§15).
//
// The same rules run over the whole project (so the milestone is judged in its
// real context), then only the signals that describe this milestone or its own
// payments are kept. The milestone's own figures are summarised separately.
function analyzeMilestoneRisk({
  project,
  tenders = [],
  milestones = [],
  payments = [],
  milestoneId,
} = {}) {
  const id = Number(milestoneId);
  const milestone = (milestones || []).find((entry) => entry.id === id) || null;

  if (!milestone) {
    return null;
  }

  const milestonePayments = (payments || []).filter((payment) => payment.milestone_id === id);
  const paymentIds = new Set(milestonePayments.map((payment) => payment.id));
  const fullAnalysis = analyzeProjectRisk({ project, tenders, milestones, payments });

  const relevant = fullAnalysis.signals.filter(
    (signal) =>
      signal.evidence &&
      ((signal.evidence.milestoneId !== undefined && signal.evidence.milestoneId === id) ||
        (signal.evidence.paymentId !== undefined && paymentIds.has(signal.evidence.paymentId)))
  );

  const totals = sumPaymentsByStatus(milestonePayments);
  const amount = toNumber(milestone.amount);
  const requestedDates = milestonePayments.map((payment) => payment.requested_at).filter(Boolean);
  const releasedDates = milestonePayments.map((payment) => payment.released_at).filter(Boolean);

  return {
    ...finalizeRisk(relevant, null),
    milestoneId: id,
    projectId: (project && project.id) || milestone.project_id || null,
    milestone: {
      id: milestone.id,
      project_id: milestone.project_id,
      title: milestone.title,
      status: milestone.status,
      amount,
      due_date: milestone.due_date || null,
      created_at: milestone.created_at || null,
      updated_at: milestone.updated_at || null,
    },
    summary: {
      milestoneAmount: amount,
      milestoneStatus: milestone.status,
      dueDate: milestone.due_date || null,
      paymentCount: milestonePayments.length,
      totalRequestedPayments: totals.REQUESTED,
      totalAuthorizedPayments: totals.AUTHORIZED,
      totalReleasedPayments: totals.RELEASED,
      totalRejectedPayments: totals.REJECTED,
      paymentsTotal: totals.REQUESTED + totals.AUTHORIZED + totals.RELEASED,
      requestedAgainstMilestone: ratioOf(totals.REQUESTED, amount),
      authorizedAgainstMilestone: ratioOf(totals.AUTHORIZED, amount),
      releasedAgainstMilestone: ratioOf(totals.RELEASED, amount),
      firstRequestedAt: earliest(requestedDates),
      lastReleasedAt: latest(releasedDates),
    },
    // The project-wide context the milestone sits in, for orientation only.
    projectRiskLevel: fullAnalysis.riskLevel,
    projectRiskScore: fullAnalysis.riskScore,
    analyzed: {
      ...fullAnalysis.analyzed,
      payments: milestonePayments.length,
      milestonePayments: milestonePayments.length,
    },
  };
}

// Entry points and rule functions. The rule functions are exported so they can
// be unit-tested and reused by later stages (4.3) without duplicating logic.
module.exports = {
  RISK_LEVELS,
  RISK_THRESHOLDS,
  SEVERITY_WEIGHTS,
  SIGNAL_CATEGORIES,
  DISCLAIMER,
  // Stage 4.1 rules
  analyzeTenderBudget,
  analyzePaymentWorkflow,
  analyzeTimeline,
  // Stage 4.2 rules
  analyzeMilestoneAllocation,
  analyzeMilestonePaymentRatio,
  analyzeMultiplePayments,
  analyzeProgressVsPayment,
  analyzeCumulativePayments,
  analyzeContractorConcentration,
  // scoring / helpers
  calculateRiskScore,
  dedupeSignals,
  sortSignals,
  hasBlockingSignal,
  summarizeFinancials,
  // entry points
  analyzeProjectRisk,
  analyzeMilestoneRisk,
};

