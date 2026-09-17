# GovChain

A full-stack web platform for **transparent government project spending and procurement**.

Current stage: **Stage 1 · Module 4 — Tender & Milestone Management**.

- Module 1 (done): Project initialization — React/Vite frontend, Node.js/Express backend, PostgreSQL connection.
- Module 2 (done): User registration, login, password hashing (bcrypt), JWT authentication, and role-based access control.
- Module 3 (done): Project management — Government Officers create/update projects; authenticated users can view them.
- Module 4 (current): Tender & milestone management + role-based dashboards — officers create tenders, assign contractors, and manage milestones; contractors track their assigned projects/tenders/milestones; auditors get read-only views.
- Future modules (not implemented): verification, payments, blockchain, AI, public transparency portal.

## Tech Stack

| Layer    | Technology                                             |
| -------- | ------------------------------------------------------ |
| Frontend | React 18, Vite 5, JavaScript (JSX), React Router 6, Tailwind CSS 3 |
| Backend  | Node.js, Express 4, JavaScript, `pg` (PostgreSQL)      |
| Auth     | `bcryptjs` (password hashing), `jsonwebtoken` (JWT)    |
| Extras   | dotenv, cors                                           |

## Folder Structure

```text
govchain/
├── client/                     # React + Vite frontend
│   ├── src/
│   │   ├── components/         # Shared components (AppLayout, ProtectedRoute, ProjectForm, MilestoneForm, StatCard)
│   │   ├── context/            # AuthContext provider + useAuth hook
│   │   ├── pages/              # Home, Health, Login, Register, per-role Dashboards, Projects, Tenders, Milestones
│   │   ├── services/           # Backend API + auth + project + tender + milestone clients
│   │   ├── utils/              # Shared stats/aggregation helpers
│   │   ├── App.jsx             # Router setup
│   │   ├── index.css           # Tailwind CSS entry
│   │   └── main.jsx            # App entry point (wires up AuthProvider)
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js          # Dev proxy: /api → http://localhost:5000
│   ├── tailwind.config.js
│   └── postcss.config.js
│
├── server/                     # Node.js + Express backend
│   ├── config/                 # PostgreSQL connection (pg pool)
│   ├── controllers/            # Request handlers
│   ├── db/                     # Schema + init script (users, projects, tenders, milestones)
│   ├── middleware/             # authenticate + role authorization
│   ├── models/                 # SQL queries (user, project, tender, milestone models)
│   ├── routes/                 # API route definitions
│   ├── services/               # Business logic
│   ├── utils/                  # JWT + role helpers
│   ├── server.js               # Server entry point
│   └── package.json
│
├── .gitignore
├── README.md
└── package.json                # Root scripts to manage both apps
```

## Requirements

- Node.js 18.11+ (required for the `node --watch` dev command); Node 20+ recommended.
- PostgreSQL (local or remote) for the application tables.

## Installation

```bash
# From the project root the first time:
npm run install:all
```

This installs the server and client dependencies. (Alternatively: `cd server && npm install` and `cd client && npm install`.)

## Environment Variables

Create a `server/.env` file and fill in your values:

| Variable       | Example                                               | Description |
| -------------- | ---------------------------------------------------- | ----------- |
| `PORT`         | `5000`                                               | Port the Express server listens on |
| `DATABASE_URL` | `postgresql://user:password@localhost:5432/govchain` | PostgreSQL connection string |
| `JWT_SECRET`   | `some-long-random-secret-string`                     | Secret used to sign and verify JWT tokens |

Optional — create a `client/.env` file:

| Variable       | Example                     | Description |
| -------------- | --------------------------- | ----------- |
| `VITE_API_URL` | `http://localhost:5000/api` | Backend API base URL. If unset, the frontend calls `/api`, which the Vite dev server proxies to the backend. |

Never commit real credentials — `.env` files are ignored by git.

## Database

The database itself (e.g. `govchain`) must already exist in your PostgreSQL server — the schema only creates the tables inside it.

1. Make sure PostgreSQL is running and `server/.env` has a valid `DATABASE_URL`.
2. Create the application tables:

```bash
npm run db:init        # from the project root (delegates to server/)
# or: cd server && npm run db:init
```

The schema (`server/db/schema.sql`) creates the `users` table (`id`, `name`, `email` unique, `password_hash`, `role`, `created_at`), the `projects` table (`id`, `name`, `description`, `budget`, `location`, `start_date`, `end_date`, `status`, `created_by`, `created_at`, `updated_at`), the `tenders` table (`id`, `project_id` → `projects.id`, `title`, `description`, `tender_amount`, `contractor_id` → `users.id`, `status` `OPEN` | `ASSIGNED` | `CLOSED`, `created_by`, `created_at`, `updated_at`), and the `milestones` table (`id`, `project_id` → `projects.id`, `title`, `description`, `amount`, `due_date`, `status` `PENDING` | `IN_PROGRESS` | `COMPLETED`, `created_at`, `updated_at`). The schema is idempotent (`CREATE TABLE IF NOT EXISTS`), so it can be run safely any number of times.

For convenience, the backend also applies this schema automatically on startup (via `server/db/init.js`), so simply restarting the server creates any missing tables.

## Running

```bash
# Run server + client together (from the project root):
npm run dev

# Or run each separately:
npm run dev:server   # backend → http://localhost:5000
npm run dev:client   # frontend → http://localhost:5173
```

- Frontend: http://localhost:5173
  - `/` → Home (auth-aware navigation)
  - `/health` → Backend health page
  - `/login` → Login
  - `/register` → Register
  - `/dashboard` → Role-based dashboard (Government Officer / Contractor / Auditor)
  - `/projects` → Project list (protected)
  - `/projects/new` → Create project (protected, Government Officer)
  - `/projects/:id` → Project details (protected)
  - `/projects/:id/edit` → Edit project (protected, Government Officer)
  - `/tenders` → Tender list (protected)
  - `/tenders/new` → Create tender (protected, Government Officer)
  - `/tenders/:id` → Tender details + assign contractor (protected)
  - `/milestones` → Milestones list (contractor: assigned only; auditor: all; read-only)
- Backend API:
  - `GET  /api/health` → health check
  - `POST /api/auth/register` → body `{ name, email, password, role }` — role: `government_officer` | `contractor` | `auditor`
  - `POST /api/auth/login` → body `{ email, password }` → `{ token, user }`
  - `GET  /api/auth/me` → requires `Authorization: Bearer <token>` → current user
  - `GET  /api/projects` → list projects (any authenticated user)
  - `GET  /api/projects/:id` → single project (any authenticated user)
  - `POST /api/projects` → create project (Government Officer) — body `{ name, description, budget, location, start_date, end_date, status }`
  - `PUT  /api/projects/:id` → update project (Government Officer) — same body as create
  - `GET  /api/projects/:projectId/milestones` → project milestones (any authenticated user)
  - `POST /api/projects/:projectId/milestones` → create milestone (Government Officer)
  - `GET  /api/tenders` → list tenders (any authenticated user, optional `?project_id=`)
  - `GET  /api/tenders/:id` → single tender (any authenticated user)
  - `POST /api/tenders` → create tender (Government Officer) — body `{ project_id, title, description, tender_amount, status }`
  - `PUT  /api/tenders/:id/assign` → assign contractor (Government Officer) — body `{ contractor_id }`; the selected user must have the `contractor` role
  - `PUT  /api/milestones/:id` → update milestone status (Government Officer, or a Contractor assigned to the project) — body `{ status }`
  - `GET  /api/users?role=contractor` → list users by role (Government Officer only)

Example health response:

```json
{
  "status": "ok",
  "message": "GovChain backend is running",
  "database": "connected",
  "timestamp": "2026-01-01T00:00:00.000Z"
}
```

## Authentication Model

- Passwords are hashed with `bcryptjs` (10 salt rounds); only the hash is stored.
- Password hashes are never returned by any endpoint.
- Login returns a JWT signed with `JWT_SECRET`; the payload contains `{ id, email, role }` and expires after 7 days.
- `authenticate` middleware validates the JWT and sets `req.user`.
- `requireRole(...roles)` middleware restricts routes by role, with convenience guards `requireGovernmentOfficer`, `requireContractor`, `requireAuditor`.
- Project access: viewing projects (`GET /api/projects*`) requires any valid JWT; creating/updating projects (`POST` / `PUT /api/projects*`) requires the `government_officer` role via `requireRole`.
- Tender access: creating a tender and assigning a contractor require the `government_officer` role (assignment also verifies the selected user has the `contractor` role); viewing tenders requires any valid JWT.
- Milestone access: creating milestones requires `government_officer`; viewing milestones requires any authenticated user; updating milestone status is allowed for `government_officer` or a `contractor` assigned to a tender on that project (auditors only view).
- The corresponding frontend pages use the role-guarded `ProtectedRoute` components and a shared role-aware navigation layout; the contractor picker uses `GET /api/users?role=contractor`. Contractor project/tender/milestone lists are filtered to their assignments on the client, while the backend continues to authorize every write.

## Notes

- The server uses CommonJS (`require`); the client uses ES modules.
- The Vite dev server proxies `/api` to `http://localhost:5000` — update `client/vite.config.js` if you change the backend port.
- No verification, payment, blockchain, public transparency or AI features are implemented in this stage.