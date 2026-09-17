-- GovChain — Stage 1 · Modules 2 - 4
-- Database schema for authentication, project, tender and milestone management.
-- No contractor assignment beyond tenders, payment, verification, blockchain or AI tables yet.

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
              CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED')),
  created_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);