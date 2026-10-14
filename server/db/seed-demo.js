// Demo data seeder. Drives the running backend through its own HTTP API so every
// record goes through the normal validation, role checks and blockchain events.
//
//   1. start the backend (npm run dev) with the database + local chain running
//   2. npm run db:seed            (optionally: API_URL=http://localhost:5000/api)
//
// Safe to re-run: users that exist are logged in instead of re-created, and a
// project whose name already exists is skipped.

const API_URL = process.env.API_URL || 'http://localhost:5000/api';

// Demo accounts. All share one demo password — local development only.
const DEMO_PASSWORD = 'Demo@12345';
const USERS = [
  { name: 'Anita Rao', email: 'officer.anita@govchain.test', role: 'government_officer' },
  { name: 'Vikram Mehta', email: 'officer.vikram@govchain.test', role: 'government_officer' },
  { name: 'Sunil Verma', email: 'auditor.sunil@govchain.test', role: 'auditor' },
  { name: 'Meera Iyer', email: 'auditor.meera@govchain.test', role: 'auditor' },
  { name: 'Apex Infra Ltd', email: 'apex@govchain.test', role: 'contractor' },
  { name: 'BlueRiver Constructions', email: 'blueriver@govchain.test', role: 'contractor' },
  { name: 'Northstar Builders', email: 'northstar@govchain.test', role: 'contractor' },
  { name: 'Sagar Engineering Works', email: 'sagar@govchain.test', role: 'contractor' },
  { name: 'Metro Link Projects', email: 'metrolink@govchain.test', role: 'contractor' },
];

const DAY = 24 * 60 * 60 * 1000;
const iso = (offsetDays) => new Date(Date.now() + offsetDays * DAY).toISOString().slice(0, 10);

// outcome: how far the milestones of the project progress.
const PROJECTS = [
  { name: 'NH-48 Highway Widening', location: 'Pune', budget: 480000000, status: 'IN_PROGRESS', start: -200, end: 160 },
  { name: 'Riverfront Promenade Phase 2', location: 'Ahmedabad', budget: 145000000, status: 'IN_PROGRESS', start: -150, end: 90 },
  { name: 'Smart City Command Centre', location: 'Surat', budget: 220000000, status: 'IN_PROGRESS', start: -120, end: 200 },
  { name: 'District Hospital Block C', location: 'Nagpur', budget: 310000000, status: 'IN_PROGRESS', start: -300, end: 20 },
  { name: 'Metro Line 3 Viaduct', location: 'Mumbai', budget: 950000000, status: 'IN_PROGRESS', start: -400, end: -10 },
  { name: 'Rural Roads Package A', location: 'Jaipur', budget: 85000000, status: 'COMPLETED', start: -500, end: -120 },
  { name: 'Municipal Water Pipeline Upgrade', location: 'Indore', budget: 120000000, status: 'COMPLETED', start: -450, end: -60 },
  { name: 'Government School Renovation Drive', location: 'Bhopal', budget: 60000000, status: 'IN_PROGRESS', start: -90, end: 120 },
  { name: 'Solar Park Grid Connection', location: 'Jodhpur', budget: 275000000, status: 'PLANNED', start: 30, end: 330 },
  { name: 'City Bus Depot Modernisation', location: 'Lucknow', budget: 98000000, status: 'PLANNED', start: 45, end: 280 },
  { name: 'Flood Drainage Channel Repair', location: 'Patna', budget: 72000000, status: 'PLANNED', start: 60, end: 240 },
  { name: 'Airport Access Flyover', location: 'Hyderabad', budget: 430000000, status: 'CANCELLED', start: -250, end: 100 },
  { name: 'Public Library Complex', location: 'Chennai', budget: 54000000, status: 'IN_PROGRESS', start: -60, end: 180 },
  { name: 'Coastal Erosion Barrier', location: 'Kochi', budget: 190000000, status: 'IN_PROGRESS', start: -180, end: 75 },
];

const MILESTONE_TITLES = [
  'Site survey & mobilisation',
  'Foundation works',
  'Structural framework',
  'Utilities & services',
  'Finishing & inspection',
  'Handover & documentation',
];

async function call(method, path, token, body) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await response.json();
  } catch {
    // non-JSON body
  }
  if (!response.ok) {
    const error = new Error(`${method} ${path} -> ${response.status} ${(data && data.message) || ''}`);
    error.status = response.status;
    throw error;
  }
  return data;
}

// Tolerant wrapper: a failed optional step is logged and skipped.
async function attempt(label, fn) {
  try {
    return await fn();
  } catch (error) {
    console.log(`  ! ${label}: ${error.message}`);
    return null;
  }
}

async function ensureUser(user) {
  try {
    await call('POST', '/auth/register', null, { ...user, password: DEMO_PASSWORD });
  } catch (error) {
    if (error.status !== 409) throw error;
  }
  const data = await call('POST', '/auth/login', null, { email: user.email, password: DEMO_PASSWORD });
  return { ...user, id: data.user.id, token: data.token };
}

async function main() {
  console.log(`Seeding via ${API_URL}`);
  const users = [];
  for (const u of USERS) users.push(await ensureUser(u));
  const officers = users.filter((u) => u.role === 'government_officer');
  const auditors = users.filter((u) => u.role === 'auditor');
  const contractors = users.filter((u) => u.role === 'contractor');
  console.log(`Users ready: ${officers.length} officers, ${auditors.length} auditors, ${contractors.length} contractors`);

  const existing = (await call('GET', '/projects', officers[0].token)).projects || [];
  const existingNames = new Set(existing.map((p) => p.name));

  const counts = { projects: 0, tenders: 0, milestones: 0, payments: 0 };
  let p = 0;

  for (const spec of PROJECTS) {
    const idx = p++;
    if (existingNames.has(spec.name)) {
      console.log(`- ${spec.name}: exists, skipped`);
      continue;
    }
    const officer = officers[idx % officers.length];
    const auditor = auditors[idx % auditors.length];
    const contractor = contractors[idx % contractors.length];

    const created = await call('POST', '/projects', officer.token, {
      name: spec.name,
      description: `${spec.name} — civil works programme in ${spec.location}, funded from the state infrastructure budget.`,
      location: spec.location,
      budget: spec.budget,
      status: spec.status,
      start_date: iso(spec.start),
      end_date: iso(spec.end),
    });
    const project = created.project;
    counts.projects += 1;
    console.log(`- ${spec.name} (#${project.id}, ${spec.status})`);

    // Tenders: a main (assigned unless planned/cancelled) plus a few open ones.
    const mainTender = await call('POST', '/tenders', officer.token, {
      project_id: project.id,
      title: `${spec.name} — main works contract`,
      description: 'Primary construction contract covering all milestones.',
      tender_amount: Math.round(spec.budget * 0.85),
    });
    counts.tenders += 1;
    const assigned = spec.status === 'IN_PROGRESS' || spec.status === 'COMPLETED';
    if (assigned) {
      await attempt('assign', () =>
        call('PUT', `/tenders/${mainTender.tender.id}/assign`, officer.token, { contractor_id: contractor.id })
      );
    }
    const extras = idx % 3 === 0 ? 2 : 1;
    for (let t = 1; t <= extras; t += 1) {
      await attempt('tender', () =>
        call('POST', '/tenders', officer.token, {
          project_id: project.id,
          title: `${spec.name} — ${['consultancy', 'supply of materials', 'quality audit'][t - 1]}`,
          tender_amount: Math.round(spec.budget * (0.02 + 0.03 * t)),
          status: t === 2 && idx % 2 === 0 ? 'CLOSED' : 'OPEN',
        })
      );
      counts.tenders += 1;
    }

    // Milestones: 3-6 per project, spread across the project window.
    const mCount = 3 + (idx % 4);
    const share = Math.round((spec.budget * 0.8) / mCount);
    const span = spec.end - spec.start;
    const milestones = [];
    for (let m = 0; m < mCount; m += 1) {
      const dueOffset = Math.round(spec.start + (span * (m + 1)) / mCount);
      const res = await call('POST', `/projects/${project.id}/milestones`, officer.token, {
        title: MILESTONE_TITLES[m],
        description: `${MILESTONE_TITLES[m]} for ${spec.name}.`,
        amount: share,
        due_date: iso(dueOffset),
      });
      milestones.push({ ...res.milestone, dueOffset });
      counts.milestones += 1;
    }

    if (!assigned) continue;

    // Drive milestones through the lifecycle based on how far the project is.
    for (let m = 0; m < milestones.length; m += 1) {
      const ms = milestones[m];
      const done = spec.status === 'COMPLETED' ? true : ms.dueOffset < 0 || m === 0;
      // Variety: a late-stage milestone stays pending/overdue, one gets rejected.
      const rejectThis = idx % 4 === 1 && m === 1;
      const stallThis = idx % 3 === 2 && m === milestones.length - 1;

      if (!done && !stallThis) {
        if (m % 2 === 0) {
          await attempt('in-progress', () =>
            call('PUT', `/milestones/${ms.id}`, contractor.token, { status: 'IN_PROGRESS' })
          );
        }
        continue;
      }
      if (stallThis) continue; // left PENDING -> shows up as overdue for risk signals

      const submitted = await attempt('submit', () => call('PUT', `/milestones/${ms.id}/submit`, contractor.token));
      if (!submitted) continue;

      if (rejectThis) {
        await attempt('reject', () =>
          call('PUT', `/milestones/${ms.id}/reject`, auditor.token, { reason: 'Inspection found incomplete work; resubmit after rectification.' })
        );
        continue;
      }
      // Some stay SUBMITTED awaiting review.
      if (idx % 5 === 4 && m === milestones.length - 1) continue;

      const verified = await attempt('verify', () => call('PUT', `/milestones/${ms.id}/verify`, auditor.token));
      if (!verified) continue;

      // Payments for verified milestones: mix of every state.
      const payment = await attempt('payment', () =>
        call('POST', '/payments', contractor.token, { milestone_id: ms.id, amount: share })
      );
      if (!payment) continue;
      counts.payments += 1;
      const pid = payment.payment.id;
      const pick = (idx + m) % 5;
      if (pick === 0) continue; // left REQUESTED
      if (pick === 1) {
        await attempt('payment reject', () =>
          call('PUT', `/payments/${pid}/reject`, officer.token, { reason: 'Invoice does not match verified quantities.' })
        );
        continue;
      }
      const authorized = await attempt('authorize', () => call('PUT', `/payments/${pid}/authorize`, officer.token));
      if (authorized && pick >= 3) {
        await attempt('release', () => call('PUT', `/payments/${pid}/release`, officer.token));
      }
    }
  }

  console.log('\nDone. Created:', counts);
  console.log('Demo logins use the addresses in USERS (see top of this file) and DEMO_PASSWORD.');
}

main().catch((error) => {
  console.error(`Seeding failed: ${error.message}`);
  process.exit(1);
});
