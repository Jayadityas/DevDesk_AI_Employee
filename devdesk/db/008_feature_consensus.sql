ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_state_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_state_check CHECK(state IN
 ('QUEUED','CANCELLED','INVESTIGATING','INVESTIGATED_READ_ONLY','NEEDS_INFORMATION',
 'AWAITING_BUG_APPROVAL','AWAITING_FEATURE_VOTE','INVALID','READY','IMPLEMENTING','VERIFYING',
 'CANDIDATE_READY','REPAIR_BLOCKED','AWAITING_ACCEPTANCE','ACCEPTED','CANDIDATE_REJECTED',
 'INTEGRATING','INTEGRATION_BLOCKED','COMPLETED'));
ALTER TABLE scope_proposals DROP CONSTRAINT IF EXISTS scope_proposals_profile_check;
ALTER TABLE repair_runs DROP CONSTRAINT IF EXISTS repair_runs_profile_check;
ALTER TABLE integration_runs DROP CONSTRAINT IF EXISTS integration_runs_profile_check;
ALTER TABLE scope_proposals ADD CONSTRAINT scope_proposals_profile_check CHECK(profile IN('frontend','backend','feature'));
ALTER TABLE repair_runs ADD CONSTRAINT repair_runs_profile_check CHECK(profile IN('frontend','backend','feature'));
ALTER TABLE integration_runs ADD CONSTRAINT integration_runs_profile_check CHECK(profile IN('frontend','backend','feature'));
CREATE TABLE IF NOT EXISTS feature_polls (
 id text PRIMARY KEY, proposal_id text NOT NULL UNIQUE REFERENCES scope_proposals(id),
 ticket_id bigint NOT NULL REFERENCES tickets(id), scope_hash text NOT NULL,
 goal_hash text NOT NULL, roster_size integer NOT NULL CHECK(roster_size BETWEEN 1 AND 1000),
 threshold integer NOT NULL CHECK(threshold=(2*roster_size+2)/3),
 deadline timestamptz NOT NULL, state text NOT NULL DEFAULT 'OPEN' CHECK(state IN('OPEN','PASSED','REJECTED','STALE')),
 created_at timestamptz NOT NULL DEFAULT now(), closed_at timestamptz
);
CREATE TABLE IF NOT EXISTS feature_poll_members (
 poll_id text NOT NULL REFERENCES feature_polls(id), employee_id bigint NOT NULL REFERENCES employees(id),
 name text NOT NULL, PRIMARY KEY(poll_id,employee_id)
);
CREATE TABLE IF NOT EXISTS feature_votes (
 poll_id text NOT NULL, employee_id bigint NOT NULL, choice text NOT NULL CHECK(choice IN('YES','NO')),
 goal_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(poll_id,employee_id), FOREIGN KEY(poll_id,employee_id) REFERENCES feature_poll_members(poll_id,employee_id)
);
