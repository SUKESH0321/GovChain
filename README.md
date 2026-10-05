# GovChain

**GovChain** is a transparency and efficiency platform for government spending and procurement. It tracks public funds from their initial allocation down to the final contractor payment, ensuring verifiability through an immutable blockchain audit trail and proactive AI risk analysis. 

The core lifecycle involves:

`Government Officer -> Project -> Tender -> Contractor -> Milestones -> Verification -> Payment -> Blockchain Audit Trail -> AI Risk Analysis`

GovChain combines state-of-the-art government project management, role-based access control, procurement and tender management, milestone tracking, comprehensive payment workflows, blockchain-backed auditability, and AI-assisted risk and anomaly analysis into a single unified platform. 

The blockchain serves strictly as a trust and audit layer. Local AI algorithms intelligently identify project and financial risks, assisting human auditors without automatically declining workflows.

---

## Current Feature Set

### Authentication & Roles
GovChain supports robust role-based access control (RBAC).
- **Government Officer**: Manages projects, tenders, milestones, and authorizes/releases payments.
- **Contractor**: Submits milestones and requests payments for assigned tenders.
- **Auditor**: Read-only oversight role equipped with the Risk Dashboard and access to project histories. 

### Project Management
- **Lifecycle**: Complete control over project creation, updates, and status tracking (PLANNED, IN_PROGRESS, COMPLETED, CANCELLED).
- **Data Attributes**: Real-world attributes including budget, geographic location, dates, and ownership records.

### Tender Management
- **Workflow**: Tender creation, status tracking (OPEN, ASSIGNED, CLOSED), and contractor assignment.
- **Financial Relationships**: Strong association between tenders and their parent projects, along with tracking total tender amounts.

### Milestone Management
- **Lifecycle**: PENDING -> IN_PROGRESS -> SUBMITTED -> VERIFIED -> REJECTED -> COMPLETED.
- **Actions**: Milestone creation, submission, structured verification, and rejection with reasons.
- **Data**: Enforcement of milestone monetary amounts and due dates.

### Payment Management
GovChain implements a complete simulated payment release system (it does not integrate with real banking infrastructure).
- **Lifecycle**: `REQUESTED` -> `AUTHORIZED` -> `RELEASED`
- **Actions**: Payment requests, authorizations, simulated release, or rejections. 
- **Audit**: Maintained payment history, strict role-based access to payment controls (officers authorize vs. contractors request), and direct project/milestone payment associations.

---

## Blockchain Audit Trail

GovChain utilizes a **REAL EVM-compatible blockchain** (powered by Hardhat, Solidity, and ethers.js). *Note: Hyperledger Fabric is NOT used.*

The smart contract acts solely as a verifiable audit log. It emits highly detailed events providing an immutable history of off-chain database actions. These events are captured along with their transaction hashes, block numbers, actors, and timestamps.

**Implemented Events:**
- `ProjectCreated` / `ProjectUpdated`
- `TenderCreated` / `TenderAssigned`
- `MilestoneCreated` / `MilestoneSubmitted` / `MilestoneVerified` / `MilestoneRejected`
- `PaymentAuthorized` / `PaymentReleased`

### Blockchain Architecture

GovChain follows a "PostgreSQL-first, Blockchain-second" architectural pattern. Transactions never block the primary user experience. The system retrieves actual transaction hashes and block numbers to prove chronological integrity.

```text
       Frontend (React)
             ↓
     Express Backend
             ↓
     PostgreSQL Database  ←–– source of truth for business logic
             ↓
     Blockchain Service   ←–– centralizes provider/signer/transaction handling
             ↓
     Hardhat EVM Network (localhost)
             ↓
  GovChain Solidity Contract ←–– immutable audit ledger
```

---

## AI Risk Analysis & Dashboard

GovChain features a deterministic, local Risk Analysis engine designed to be an **assistive decision-support system**. 

**Important:** The AI is strictly advisory. It does **not** prove fraud, prove corruption, automatically accuse contractors, or automatically block payments. Human review remains central to the final workflow execution. 

### Implemented Analysis Signals:
The engine provides an explainable overall risk score across `LOW`, `MEDIUM`, or `HIGH` severities by evaluating:
- **Tender Budget Anomalies**: Flagging tenders that dramatically under-cost or over-cost the allocated project budget.
- **Milestone Allocation Anomalies**: Ensuring planned milestones logically align with the secured project budget and awarded tender.
- **Payment / Milestone Ratios**: Detecting when payment amounts abnormally exceed the base milestone limits.
- **Cumulative Payments**: Flagging when total authorized/released payments exceed the budget or tender amount.
- **Multiple Payments per Milestone**: Notifying anomalous overlapping active payment requests.
- **Workflow Inconsistencies**: Exposing when payments exist for unverified milestones.

### Risk Dashboard
The Risk Analysis page centrally displays these AI risk insights. It grants Auditors and Government Officers visibility into overall risk scores, severity-level indicators, underlying evidence (percentages, dates, identifiers), financial breakdowns across the platform, and localized project alerts.

---

## Application URL Structure

The GovChain frontend employs the `/Govchain` base path prefix. API interfaces are neatly separated under the `/api` prefix on the backend.

### Primary Frontend Routes
*(Assuming development starts on port 5173)*
- **Home**: `http://localhost:5173/Govchain`
- **Dashboard**: `http://localhost:5173/Govchain/dashboard`
- **Projects**: `http://localhost:5173/Govchain/projects`
- **Payments**: `http://localhost:5173/Govchain/payments`
- **Risk Analysis**: `http://localhost:5173/Govchain/risk`

---

## Technology Stack

**Frontend**
- React 18
- Tailwind CSS (Styling)
- React Router (Routing)
- GSAP & OGL (Animation & UI elements)
- Vite (Build Tool)

**Backend**
- Node.js
- Express.js
- JSON Web Tokens (JWT AUTH)
- bcryptjs (Hashing)
- ethers.js (EVM interactions)

**Database**
- PostgreSQL (pg)

**Blockchain**
- Solidity
- Hardhat (EVM Environment)

---

## Project Structure

```text
GovChain/
├── blockchain/          # Hardhat configuration, smart contracts, ethers.js deployments
│   ├── contracts/       # GovChain.sol (The immutable audit ledger)
│   ├── scripts/         # Deployment scripts
│   └── hardhat.config.js
├── client/              # React/Vite Frontend
│   ├── src/
│   │   ├── components/  # Reusable UI modules/AppLayout
│   │   ├── pages/       # Dashboard, Risk, Payments, etc.
│   │   └── App.jsx      # Frontend router definition
├── server/              # Express/Node API Server
│   ├── config/          # DB/Blockchain config parameters 
│   ├── controllers/     # Express route handlers
│   ├── db/              # PostgreSQL schema (schema.sql), init logic
│   ├── models/          # DB queries/transactions 
│   ├── routes/          # Express app router mounts 
│   └── services/        # Business logic, Risk AI engine, Blockchain Service
└── README.md
```

---

## Local Setup & Installation

### Prerequisites
- Node.js (v18 or higher)
- npm
- PostgreSQL (Running locally)
*Note: Docker is not required.*

### 1. Database Setup
Create your local PostgreSQL database (e.g., `govchain_db`). The backend executes a schema script `server/db/schema.sql` automatically or via initialization scripts.

### 2. Environment Variables
Create a `.env` file in the `server` directory and define your variables. Use the placeholders below:

```env
# server/.env
PORT=5000
DATABASE_URL=postgres://user:password@localhost:5432/govchain_db
JWT_SECRET=your_secret_here

BLOCKCHAIN_ENABLED=true
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
# Copy the private key generated by your local Hardhat node
BLOCKCHAIN_PRIVATE_KEY=your_private_key_here 
# Copy the deployed address after running 'npm run deploy'
GOVCHAIN_CONTRACT_ADDRESS=your_deployed_contract_here
```

### 3. Startup Guide

The application components must be started in three separate terminal windows. 

**Terminal 1: Start the Blockchain Node**
```bash
cd blockchain
npm install
npm run node
```
*(Leave this node running. Copy the first private key and paste it into `server/.env` under `BLOCKCHAIN_PRIVATE_KEY`)*

**Terminal 2: Deploy the Contract and Start the Backend**
```bash
cd blockchain
npm run deploy
```
*(Copy the deployed contract address and paste it into `server/.env` under `GOVCHAIN_CONTRACT_ADDRESS`)*

```bash
cd ../server
npm install
npm run db:init  # (Optional: Schema creates automatically on server start)
npm start
```

**Terminal 3: Start the Frontend**
```bash
cd client
npm install
npm run dev
```

Visit the application at: `http://localhost:5173/Govchain`

---

## User Workflow Example

1. **Government Officer**: Logs in, clicks "Create Project", and provisions a new infrastructure project. 
2. **Government Officer**: Creates an associated Tender for the project and assigns a **Contractor**.
3. **Government Officer**: Defines Milestones ensuring completion criteria and budget adherence.
4. **Contractor**: Logs in, reviews assigned tenders, and submits a Milestone (e.g., "Foundation Level").
5. **Government Officer/Auditor**: Reviews the work submitted and sets the Milestone as `VERIFIED`.
6. **Contractor**: Requests payment for the verified milestone.
7. **Government Officer**: Authorizes the payment inside the Payments dashboard. (Transitions state to `AUTHORIZED`).
8. **Government Officer**: Officially triggers the payment release (Transitions state to `RELEASED`).
9. **System (Blockchain)**: Every major action silently records transaction hashes natively on the local EVM. 
10. **System (Risk AI)**: The AI Engine continuously analyzes real-time payments vs. milestone budgets and updates the centralized Risk Dashboard for Auditors to oversee.

---

## Security Model
- **Authentication**: Stateless robust JSON Web Tokens (JWT) distributed upon login.
- **Passwords**: Securely salted and hashed utilizing `bcryptjs`.
- **Role-Based Routing**: Strict frontend and backend access control checks determining read/write properties according to the `government_officer`, `contractor`, or `auditor` role.
- **Immutability**: Crucial interactions write an idempotent record into the Ethereum Smart Contract for auditable verifiability. 
