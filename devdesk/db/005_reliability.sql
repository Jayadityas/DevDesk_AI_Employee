ALTER TABLE tickets ADD COLUMN IF NOT EXISTS cancel_requested boolean NOT NULL DEFAULT false;
ALTER TABLE investigation_runs DROP CONSTRAINT IF EXISTS investigation_runs_state_check;
ALTER TABLE investigation_runs ADD CONSTRAINT investigation_runs_state_check CHECK(state IN('RUNNING','FINISHED','NEEDS_INFORMATION','INTERRUPTED','CANCELLED'));
ALTER TABLE investigation_runs ADD COLUMN IF NOT EXISTS lease_token text NOT NULL DEFAULT '';
ALTER TABLE investigation_runs ADD COLUMN IF NOT EXISTS lease_fence bigint NOT NULL DEFAULT 0;
ALTER TABLE repair_runs ADD COLUMN IF NOT EXISTS lease_token text NOT NULL DEFAULT '';
ALTER TABLE repair_runs ADD COLUMN IF NOT EXISTS lease_fence bigint NOT NULL DEFAULT 0;
ALTER TABLE repair_runs ADD COLUMN IF NOT EXISTS scope_hash text NOT NULL DEFAULT '';
UPDATE repair_runs rr SET scope_hash=p.scope_hash FROM scope_proposals p WHERE p.id=rr.proposal_id AND rr.scope_hash='';
ALTER TABLE integration_runs ADD COLUMN IF NOT EXISTS lease_token text NOT NULL DEFAULT '';
ALTER TABLE integration_runs ADD COLUMN IF NOT EXISTS lease_fence bigint NOT NULL DEFAULT 0;
ALTER TABLE scope_proposals DROP CONSTRAINT IF EXISTS scope_proposals_investigation_run_key;
CREATE UNIQUE INDEX IF NOT EXISTS current_scope_revision ON scope_proposals(investigation_run) WHERE state IN('PROPOSED','APPROVED');
CREATE TABLE IF NOT EXISTS preview_runs(id text PRIMARY KEY,state text NOT NULL,result jsonb,summary text,started_at timestamptz NOT NULL DEFAULT now(),finished_at timestamptz);
CREATE TABLE IF NOT EXISTS public.worker_leases (
 project_id bigint PRIMARY KEY,owner_token text NOT NULL,owner_schema text NOT NULL,
 fence bigint NOT NULL,kind text NOT NULL,run_id text NOT NULL DEFAULT '',
 state text NOT NULL CHECK(state IN('ACTIVE','RELEASED')),
 heartbeat_at timestamptz NOT NULL,expires_at timestamptz NOT NULL
);
CREATE OR REPLACE FUNCTION enforce_worker_fence() RETURNS trigger LANGUAGE plpgsql AS $fence$
BEGIN
 IF NEW.state IS DISTINCT FROM OLD.state AND
   (OLD.state IN('INVESTIGATING','IMPLEMENTING','VERIFYING','INTEGRATING') OR
    NEW.state IN('INVESTIGATING','IMPLEMENTING','VERIFYING','INTEGRATING')) THEN
  IF NOT EXISTS(SELECT 1 FROM public.worker_leases WHERE project_id=1 AND state='ACTIVE'
    AND owner_schema=TG_TABLE_SCHEMA AND owner_token=current_setting('devdesk.worker_token',true)
    AND fence::text=current_setting('devdesk.worker_fence',true) AND expires_at>now()) THEN
   RAISE EXCEPTION 'Worker lease is stale or absent' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NEW;
END $fence$;
DROP TRIGGER IF EXISTS phase6_fence ON tickets;
CREATE TRIGGER phase6_fence BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION enforce_worker_fence();
