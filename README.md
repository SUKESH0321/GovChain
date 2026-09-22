# GovChain

GovChain is a government spending and procurement transparency and monitoring platform. It records public projects, the tenders raised against them, the contractors assigned to those tenders, and the milestones each project is paid against, then exposes those records to the roles that need them.

Current stage: **Stage 1 - core platform (projects, tenders, milestones, role-based access)**. Blockchain, payments, AI and public-transparency modules are **Planned**, not implemented.

## Overview

GovChain exists so government project spending can be followed and audited in one place instead of across spreadsheets and email threads. Records are created by Government Officers, worked on by Contractors, and examined read-only by Auditors.

The data model follows one lifecycle:

```text
Government
   ↓
Project
   ↓
Tender / Contract
   ↓
Milestones
   ↓
Verification             <- Planned
   ↓
Payment                  <- Planned
   ↓
Audit / Transparency
```

Implemented today: Government -> Project -> Tender / Contract -> Milestones, plus read-only audit views. Verification, Payment and any on-chain audit layer are future stages.

GovChain is intended to improve:

- government spending transparency
- procurement visibility
- project monitoring
- milestone tracking
- auditability
- anomaly/risk detection (Planned - today the UI only flags overdue milestones)
- accountability

Blockchain does not automatically eliminate corruption or guarantee truth. It is intended as an audit and trust layer over data whose accuracy still depends on the people and processes entering it.

## Current Implementation

Everything in this section exists in the repository today.

### Frontend

- React 18 with Vite 5 (JavaScript/JSX)
- React Router 6 with protected, role-guarded routes
- Tailwind CSS 3 plus a design-token layer in `client/src/index.css`
- Role-based dashboards: `Dashboard.jsx` renders the Officer, Contractor or Auditor dashboard from the authenticated user role
- Project management UI: searchable, sortable, filterable project list; create/edit views for officers; detail page with Overview / Tender / Milestones / Activity tabs
- Tender management UI: tender list, tender details, create-tender form, and an assign-contractor flow
- Milestone management UI: per-project milestone timeline with status controls and overdue flagging, plus a milestone register page
- Interactive application interface: shared sidebar/topbar shell, command palette (`Ctrl`/`Cmd` + `K`), toasts, drawers, modals, tabs and sortable tables
- Global animated GradientWaves background (`ogl` WebGL 2 canvas rendered behind the app shell)

### Backend

- Node.js with Express.js (CommonJS)
- PostgreSQL via the `pg` driver (lazy connection pool on `DATABASE_URL`)
- REST API mounted under `/api`
- Authentication with `bcryptjs` password hashing (10 salt rounds) and JWT (`jsonwebtoken`, 7-day expiry)
- Role-based access control via `authenticate` + `requireRole(...)` middleware, with an extra tender-assignment check on milestone updates

### Authentication / Roles

- Registration (`POST /api/auth/register`) accepts `name`, `email`, `password` and `role`; roles are self-selected at registration, there is no admin-approval step yet
- Login (`POST /api/auth/login`) verifies the password hash and returns a JWT plus the user object; `GET /api/auth/me` returns the current user; logout is client-side (token discarded)
- Government Officer: creates/updates projects, creates tenders, assigns contractors to tenders, creates milestones, updates any milestone status, lists users by role
- Contractor: reads projects, tenders and milestones; updates milestone status only on projects where a tender is assigned to them
- Auditor: read-only access to projects, tenders and milestones through a dedicated read-only console
### Project Management

- Officers create projects (`POST /api/projects`) with `name`, `description`, `budget`, `location`, `start_date`, `end_date` and `status`; any authenticated user can list or view them
- Officers update projects (`PUT /api/projects/:id`); update supports `name`, `description`, `location`, `start_date`, `end_date` and `status`
- Project statuses: `PLANNED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`
- UI: project list with search, status filter, sortable columns and expandable rows; detail page with Overview / Tender / Milestones / Activity tabs

### Tender Management

- Officers create tenders under a project (`POST /api/tenders` with `project_id`, `title`, `description`, `tender_amount`); any authenticated user can list or view tenders
- Officers assign a contractor (`PUT /api/tenders/:id/assign` with `contractor_id`); assignment stores the contractor and sets status to `ASSIGNED`
- Tender statuses: `OPEN`, `ASSIGNED`, `CLOSED` (no edit/close/re-tender endpoint exists yet)
- UI: tender list with search, status filter and sorting; tender details; create-tender form; assign-contractor flow

### Milestone Management

- Officers create milestones under a project (`POST /api/projects/:projectId/milestones` with `title`, `description`, `amount`, `due_date`); any authenticated user can list a project's milestones (`GET /api/projects/:projectId/milestones`)
- Status updates (`PUT /api/milestones/:id` with `status`) are allowed for officers on any project and for contractors assigned to a tender on that project; auditors cannot update
- Milestone statuses: `PENDING`, `IN_PROGRESS`, `COMPLETED`
- UI: per-project milestone timeline with status controls and overdue flagging, create-milestone modal, status-edit modal, and a milestone register page

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React.js |
| Build Tool | Vite |
| Styling | Tailwind CSS |
| Backend | Node.js + Express.js |
| Database | PostgreSQL |
| Authentication | JWT |
| Password Hashing | bcryptjs |
| Blockchain | Hyperledger Fabric - Planned (no Fabric code exists yet) |
| Smart Contracts | JavaScript Chaincode - Planned (no chaincode exists yet) |
| AI | TensorFlow.js / rule-based detection - Planned (only overdue-milestone flag exists today) |
| File Storage | Local initially / IPFS planned (no upload feature exists yet) |
## Project Architecture

```text
GovChain/
|-- client/
|   |-- src/
|   |   |-- components/
|   |   |-- context/
|   |   |-- pages/
|   |   |-- services/
|   |   |-- App.jsx
|   |   |-- main.jsx
|   |-- ...
|-- server/
|   |-- ...
|   |-- ...
|-- README.md
|-- package.json
|-- ...
```

Actual top-level entries are `client/`, `server/`, `README.md`, `package.json`, `package-lock.json`, `LICENSE`, `check-imports.ps1` and `.gitignore`. `client/src` contains `components/`, `context/`, `hooks/`, `pages/`, `services/`, `utils/`, `App.jsx`, `main.jsx` and `index.css`. `server/` contains `config/`, `controllers/`, `db/`, `middleware/`, `models/`, `routes/`, `services/`, `utils/` and `server.js`.
## Environment Setup

Backend configuration lives in `server/.env`. The repository does not ship a committed env template file. Create `server/.env` locally:

```env
PORT=5000
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/govchain
JWT_SECRET=your_secret_key
```

Actual credentials and secrets must not be committed. `server/.env` is git-ignored, so keep real passwords and secrets there and use placeholders in docs and screenshots.
## Installation

1. Install dependencies (first time only, from the project root):

```bash
npm run install:all
```

This runs `npm run install:server` (`cd server && npm install`) and `npm run install:client` (`cd client && npm install`).

2. Set up PostgreSQL and create the database named in `DATABASE_URL`.

3. Configure `server/.env` as shown above.

4. Apply the schema:

```bash
npm run db:init
```

5. Start the backend:

```bash
npm run dev:server
```

Backend: http://localhost:5000

6. Start the frontend (in another terminal):

```bash
npm run dev:client
```

Frontend: http://localhost:5173 (the Vite dev server proxies `/api` to the backend).

Or run both together from the root:

```bash
npm run dev
```
## Database

The schema (`server/db/schema.sql`) is idempotent and is also applied on server startup. Current tables:

- users: accounts and roles (`government_officer`, `contractor`, `auditor`)
- projects: government projects linked to the creating user
- tenders: tenders raised against a project, with optional assigned contractor
- milestones: deliverables/instalments per project

There are no verification, payment, blockchain, AI or audit-log tables yet.
## API Overview

All routes are mounted under `/api` and exchange JSON. Only endpoints that exist in the codebase are listed.

### Authentication

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
```

### Projects

```text
POST /api/projects
GET  /api/projects
GET  /api/projects/:id
PUT  /api/projects/:id
GET  /api/projects/:projectId/milestones
POST /api/projects/:projectId/milestones
```

### Tenders

```text
GET  /api/tenders
GET  /api/tenders/:id
POST /api/tenders
PUT  /api/tenders/:id/assign
```

### Milestones

```text
GET  /api/projects/:projectId/milestones
POST /api/projects/:projectId/milestones
PUT  /api/milestones/:id
```
## Role Access

Authorization is enforced by Express middleware, not by the UI.

| Feature | Government Officer | Contractor | Auditor |
|---|---|---|---|
| View projects | Yes | Yes | Yes |
| Create projects | Yes | No | No |
| Manage tenders | Yes - create and assign contractors | No - read-only | No - read-only |
| Manage milestones | Yes - create and update any status | Limited - update status only on assigned projects | No - read-only |
| Audit/read-only access | Yes | No | Yes |
## UI / UX

- Role-specific navigation and dashboards for Government Officers, Contractors and Auditors
- Interactive dashboards with project, tender and milestone views
- Project views with Overview / Tender / Milestones / Activity tabs
- Tender views with details and contractor assignment
- Milestone tracking with per-project timeline, status controls and overdue flagging
- Responsive UI with shared sidebar/topbar shell, drawers, modals, tabs and sortable tables
- Animated GradientWaves global background (WebGL canvas behind the app shell)
- Blue / sky-blue / white visual theme
## Development Status

### Implemented

- Project initialization: React/Vite frontend, Express backend and PostgreSQL pool
- Registration, login, bcryptjs password hashing, JWT authentication and role-based access control
- Project management: officers create/update, any authenticated user can view
- Tender management: officers create and assign contractors, any authenticated user can view
- Milestone management: officers create, officers or assigned contractors update status, any authenticated user can view
- Role-based dashboards plus list/detail screens for projects, tenders and milestones
- Shared authenticated shell, command palette, toasts, drawers/modals/tabs and searchable sortable tables
- Global animated GradientWaves background
- Idempotent schema applied on startup and through `npm run db:init`

### Planned

- Hyperledger Fabric integration (Coming Soon)
- Smart contracts (Coming Soon)
- Payment workflow (Coming Soon)
- AI anomaly detection (Coming Soon)
- Transparency/audit enhancements (Coming Soon)
- IPFS integration (Coming Soon)
## Roadmap

1. Frontend and Core Backend - Implemented (projects, tenders, milestones, roles, dashboards)
2. Blockchain - Planned
3. Payments - Planned
4. AI - Planned
5. Transparency - Planned
6. Testing and Deployment - Planned
## Security Notes

- Passwords are hashed with bcryptjs
- JWT authentication is used (7-day expiry; token sent as `Authorization: Bearer <token>`)
- Role-based access control is enforced server-side
- Secrets belong in `server/.env` and must not be committed
- Sensitive information should not be placed on-chain
- Blockchain should be treated as an audit/trust layer rather than a guarantee that underlying data is truthful
## Important Design Principles

- Blockchain is an audit/trust layer (Planned).
- AI flags anomalies/risk; it does not automatically determine fraud (Planned).
- Sensitive citizen information should remain off-chain.
- Payment execution should require appropriate verification/authorization (Planned).
- Transparency should expose useful public information without exposing sensitive data (Planned).
