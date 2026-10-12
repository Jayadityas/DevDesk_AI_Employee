-- Kept separate because installations may already have recorded migration 005.
CREATE TABLE IF NOT EXISTS preview_runs(id text PRIMARY KEY,state text NOT NULL,result jsonb,summary text,started_at timestamptz NOT NULL DEFAULT now(),finished_at timestamptz);
