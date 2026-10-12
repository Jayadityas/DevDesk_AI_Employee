ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_state_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_state_check CHECK(state IN
 ('QUEUED','CANCELLED','INVESTIGATING','INVESTIGATED_READ_ONLY','NEEDS_INFORMATION',
  'AWAITING_BUG_APPROVAL','READY','IMPLEMENTING','VERIFYING','CANDIDATE_READY','REPAIR_BLOCKED'));
CREATE TABLE IF NOT EXISTS scope_proposals (
 id text PRIMARY KEY, ticket_id bigint NOT NULL REFERENCES tickets(id),
 investigation_run text NOT NULL UNIQUE REFERENCES investigation_runs(id),
 revision integer NOT NULL DEFAULT 1, base_commit text NOT NULL, app_build text NOT NULL,
 files jsonb NOT NULL, criteria jsonb NOT NULL, risk text NOT NULL,
 scope_hash text NOT NULL, expires_at timestamptz NOT NULL,
 state text NOT NULL DEFAULT 'PROPOSED' CHECK(state IN('PROPOSED','APPROVED','REJECTED','STALE')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS scope_approvals (
 proposal_id text PRIMARY KEY REFERENCES scope_proposals(id), employee_id bigint NOT NULL REFERENCES employees(id),
 scope_hash text NOT NULL, approved_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS repair_runs (
 id text PRIMARY KEY, ticket_id bigint NOT NULL REFERENCES tickets(id), proposal_id text NOT NULL REFERENCES scope_proposals(id),
 mode text NOT NULL CHECK(mode IN('live','scripted_test')), state text NOT NULL,
 base_commit text NOT NULL, candidate_commit text, workspace text, diff text, summary text,
 model text NOT NULL, worker_build text NOT NULL, model_calls integer NOT NULL DEFAULT 0,
 input_tokens integer NOT NULL DEFAULT 0, output_tokens integer NOT NULL DEFAULT 0,
 estimated_usd numeric NOT NULL DEFAULT 0, usage_complete boolean NOT NULL DEFAULT true,
 started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_repair ON repair_runs(ticket_id) WHERE state IN('RUNNING','VERIFYING');
CREATE TABLE IF NOT EXISTS repair_steps (
 id bigserial PRIMARY KEY, run_id text NOT NULL REFERENCES repair_runs(id), step integer NOT NULL,
 state text NOT NULL, action jsonb, result jsonb, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(run_id,step)
);
