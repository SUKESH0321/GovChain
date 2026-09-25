-- GovChain — Stage 1 · Modules 2 - 4 + Stage 2.2/2.3 blockchain audit ledger
-- Database schema for authentication, project, tender and milestone management,
-- plus the blockchain audit ledger that links application events (projects,
-- tenders and the milestone lifecycle) to their local EVM transaction.
-- No payment, AI or public-transparency tables yet.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT         NOT NULL,
  role          VARCHAR(50)  NOT NULL DEFAULT 'contractor'
                CHECK (role IN ('government_officer', 'contractor', 'auditor')),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS projects (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(255)   NOT NULL,
  description TEXT,
  budget      NUMERIC(14, 2) NOT NULL CHECK (budget > 0),
  location    VARCHAR(255),
  start_date  DATE,
  end_date    DATE,
  status      VARCHAR(50)    NOT NULL DEFAULT 'PLANNED'
              CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
  created_by  INTEGER        NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tenders (
  id            SERIAL PRIMARY KEY,
  project_id    INTEGER        NOT NULL REFERENCES projects(id),
  title         VARCHAR(255)   NOT NULL,
  description   TEXT,
  tender_amount NUMERIC(14, 2) NOT NULL CHECK (tender_amount > 0),
  contractor_id INTEGER        REFERENCES users(id),
  status        VARCHAR(50)    NOT NULL DEFAULT 'OPEN'
                CHECK (status IN ('OPEN', 'ASSIGNED', 'CLOSED')),
  created_by    INTEGER        NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS milestones (
  id          SERIAL PRIMARY KEY,
  project_id  INTEGER        NOT NULL REFERENCES projects(id),
  title       VARCHAR(255)   NOT NULL,
  description TEXT,
  amount      NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  due_date    DATE,
  status      VARCHAR(50)    NOT NULL DEFAULT 'PENDING'
              CHECK (status IN ('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'VERIFIED', 'REJECTED', 'COMPLETED')),
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- GovChain — Stage 3.1 · payment requests
-- One row per payment request a contractor raises against a VERIFIED milestone.
-- Stage 3.2 added the RELEASED status (simulated release, authorized -> released)
-- plus the released_by / released_at audit columns. Statuses:
--   REQUESTED -> AUTHORIZED -> RELEASED   (happy path)
--   REQUESTED -> REJECTED                 (officer rejects)
CREATE TABLE IF NOT EXISTS payments (
  id            SERIAL PRIMARY KEY,
  project_id    INTEGER        NOT NULL REFERENCES projects(id),
  tender_id     INTEGER        REFERENCES tenders(id),
  milestone_id  INTEGER        NOT NULL REFERENCES milestones(id),
  contractor_id INTEGER        NOT NULL REFERENCES users(id),
  amount        NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  status        VARCHAR(20)    NOT NULL DEFAULT 'REQUESTED'
                CHECK (status IN ('REQUESTED', 'AUTHORIZED', 'REJECTED')),
  reason        TEXT,
  requested_by  INTEGER        NOT NULL REFERENCES users(id),
  authorized_by INTEGER        REFERENCES users(id),
  released_by   INTEGER        REFERENCES users(id),
  requested_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  authorized_at TIMESTAMPTZ,
  released_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_status ON payments (status);
CREATE INDEX IF NOT EXISTS idx_payments_milestone ON payments (milestone_id);
CREATE INDEX IF NOT EXISTS idx_payments_contractor ON payments (contractor_id);

-- Stage 3.1 · payments keep the hash of their authorization transaction, exactly
-- like projects/tenders/milestones. Payment events also stay in blockchain_events.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS blockchain_tx_hash VARCHAR(66);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS blockchain_block_number BIGINT;

-- GovChain — Stage 3.2 · simulated payment release columns for databases created
-- before Stage 3.2 (the CREATE TABLE above already includes them on fresh
-- databases; these ALTERs upgrade Stage 3.1 databases in place and are no-ops
-- when the columns already exist).
ALTER TABLE payments ADD COLUMN IF NOT EXISTS released_by INTEGER REFERENCES users(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ;

-- Widen the payment status CHECK for the RELEASED value (safe to re-run: the new
-- value set is a superset of the Stage 3.1 one, so existing rows satisfy it).
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE payments ADD CONSTRAINT payments_status_check
  CHECK (status IN ('REQUESTED', 'AUTHORIZED', 'REJECTED', 'RELEASED'));

-- GovChain — Stage 2.2 · blockchain audit ledger
-- One row per application event that has to be recorded on the local EVM chain.
-- PostgreSQL stays the source of truth for application data; this table only
-- links an application event to its blockchain transaction and is the source of
-- truth for idempotency (idempotency_key is UNIQUE) and for retry/reconciliation
-- (status = 'FAILED' plus error_message).
-- Stage 2.3 added 'milestone' as a third entity type.
CREATE TABLE IF NOT EXISTS blockchain_events (
  id              SERIAL PRIMARY KEY,
  idempotency_key TEXT        NOT NULL UNIQUE,
  event_name      VARCHAR(50) NOT NULL,
  entity_type     VARCHAR(20) NOT NULL CHECK (entity_type IN ('project', 'tender', 'milestone')),
  entity_id       INTEGER     NOT NULL,
  project_id      INTEGER     REFERENCES projects(id),
  actor_user_id   INTEGER     REFERENCES users(id),
  payload         JSONB       NOT NULL DEFAULT '{}'::jsonb,
  status          VARCHAR(20) NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING', 'CONFIRMED', 'FAILED')),
  tx_hash         VARCHAR(66),
  block_number    BIGINT,
  error_message   TEXT,
  attempts        INTEGER     NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_blockchain_events_status ON blockchain_events (status);
CREATE INDEX IF NOT EXISTS idx_blockchain_events_entity ON blockchain_events (entity_type, entity_id);

-- Blockchain references on the application rows themselves (nullable: Stage 1
-- rows simply have no blockchain record). `projects`/`tenders` keep the hash of
-- their creation transaction; every other event stays in blockchain_events.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS blockchain_tx_hash VARCHAR(66);
ALTER TABLE projects ADD COLUMN IF NOT EXISTS blockchain_block_number BIGINT;
ALTER TABLE tenders  ADD COLUMN IF NOT EXISTS blockchain_tx_hash VARCHAR(66);
ALTER TABLE tenders  ADD COLUMN IF NOT EXISTS blockchain_block_number BIGINT;

-- GovChain — Stage 2.3 · milestone verification ledger
-- `milestones` keeps the hash of its own creation transaction, exactly like
-- projects/tenders. Submission, verification and rejection records stay in
-- blockchain_events.
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS blockchain_tx_hash VARCHAR(66);
ALTER TABLE milestones ADD COLUMN IF NOT EXISTS blockchain_block_number BIGINT;

-- Widened for databases created before Stage 2.3. The status CHECK was declared
-- inline in Stage 1, so PostgreSQL named it milestones_status_check. The new
-- value set is a superset of the old one, so existing rows always satisfy it and
-- re-running this block is safe.
ALTER TABLE milestones DROP CONSTRAINT IF EXISTS milestones_status_check;
ALTER TABLE milestones ADD CONSTRAINT milestones_status_check
  CHECK (status IN ('PENDING', 'IN_PROGRESS', 'SUBMITTED', 'VERIFIED', 'REJECTED', 'COMPLETED'));

-- Same for the blockchain_events entity type, so 'milestone' events can be queued.
ALTER TABLE blockchain_events DROP CONSTRAINT IF EXISTS blockchain_events_entity_type_check;
ALTER TABLE blockchain_events ADD CONSTRAINT blockchain_events_entity_type_check
  CHECK (entity_type IN ('project', 'tender', 'milestone', 'payment'));