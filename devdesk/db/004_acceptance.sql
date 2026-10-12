ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_state_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_state_check CHECK(state IN
 ('QUEUED','CANCELLED','INVESTIGATING','INVESTIGATED_READ_ONLY','NEEDS_INFORMATION',
 'AWAITING_BUG_APPROVAL','READY','IMPLEMENTING','VERIFYING','CANDIDATE_READY','REPAIR_BLOCKED',
 'AWAITING_ACCEPTANCE','ACCEPTED','CANDIDATE_REJECTED','INTEGRATING','INTEGRATION_BLOCKED','COMPLETED'));
CREATE TABLE IF NOT EXISTS candidate_reviews (
 id text PRIMARY KEY, repair_id text NOT NULL REFERENCES repair_runs(id),
 employee_id bigint NOT NULL REFERENCES employees(id), candidate_commit text NOT NULL,
 scope_hash text NOT NULL, evidence_step integer NOT NULL, evidence jsonb NOT NULL,
 review_hash text NOT NULL, expires_at timestamptz NOT NULL,
 state text NOT NULL DEFAULT 'PENDING' CHECK(state IN('PENDING','ACCEPTED','REJECTED','STALE')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS candidate_decisions (
 review_id text PRIMARY KEY REFERENCES candidate_reviews(id), employee_id bigint NOT NULL REFERENCES employees(id),
 review_hash text NOT NULL, decision text NOT NULL CHECK(decision IN('ACCEPTED','REJECTED')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS integration_runs (
 id text PRIMARY KEY, ticket_id bigint NOT NULL REFERENCES tickets(id), review_id text NOT NULL UNIQUE REFERENCES candidate_reviews(id),
 state text NOT NULL, base_commit text NOT NULL, candidate_commit text NOT NULL,
 result jsonb, summary text, worker_build text NOT NULL,
 started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz
);
