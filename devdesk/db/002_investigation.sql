ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_state_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_state_check CHECK
 (state IN ('QUEUED','CANCELLED','INVESTIGATING','INVESTIGATED_READ_ONLY','NEEDS_INFORMATION'));
ALTER TABLE investigations DROP CONSTRAINT IF EXISTS investigations_state_check;
ALTER TABLE investigations ADD CONSTRAINT investigations_state_check CHECK
 (state IN ('queued','cancelled','running','reproduced','not_reproduced','needs_information'));
ALTER TABLE events ALTER COLUMN actor_id DROP NOT NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS actor_kind text NOT NULL DEFAULT 'employee'
 CHECK(actor_kind IN ('employee','worker'));
CREATE TABLE IF NOT EXISTS investigation_runs (
 id text PRIMARY KEY, ticket_id bigint NOT NULL REFERENCES tickets(id),
 mode text NOT NULL CHECK(mode IN ('live','scripted_test')),
 state text NOT NULL CHECK(state IN ('RUNNING','FINISHED','NEEDS_INFORMATION','INTERRUPTED')),
 model text NOT NULL, prompt_version text NOT NULL, worker_build text NOT NULL,
 base_commit text, app_build text, summary text, verdict text,
 model_calls integer NOT NULL DEFAULT 0, input_tokens integer NOT NULL DEFAULT 0,
 output_tokens integer NOT NULL DEFAULT 0, estimated_usd numeric NOT NULL DEFAULT 0,
 started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS one_running_investigation ON investigation_runs(ticket_id) WHERE state='RUNNING';
CREATE TABLE IF NOT EXISTS decisions (
 id bigserial PRIMARY KEY, run_id text NOT NULL REFERENCES investigation_runs(id),
 step integer NOT NULL, state text NOT NULL CHECK(state IN ('STARTED','RECEIVED','DENIED','ERROR')),
 action jsonb, provider_request_id text, input_tokens integer, output_tokens integer,
 duration_ms integer, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(run_id,step)
);
CREATE TABLE IF NOT EXISTS observations (
 id text PRIMARY KEY, run_id text NOT NULL REFERENCES investigation_runs(id),
 step integer NOT NULL, tool text NOT NULL, tool_version text NOT NULL,
 result jsonb NOT NULL, upload_id text REFERENCES uploads(id),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(run_id,step)
);
ALTER TABLE investigation_runs ADD COLUMN IF NOT EXISTS usage_complete boolean NOT NULL DEFAULT true;
