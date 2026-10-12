CREATE TABLE IF NOT EXISTS employees (
 id bigserial PRIMARY KEY, username text UNIQUE NOT NULL, name text NOT NULL,
 salt text NOT NULL, password_hash text NOT NULL, active boolean NOT NULL DEFAULT true
);
CREATE TABLE IF NOT EXISTS projects (id bigint PRIMARY KEY, name text NOT NULL);
CREATE TABLE IF NOT EXISTS memberships (
 employee_id bigint REFERENCES employees(id), project_id bigint REFERENCES projects(id),
 PRIMARY KEY(employee_id,project_id)
);
CREATE TABLE IF NOT EXISTS sessions (
 token_hash text PRIMARY KEY, employee_id bigint NOT NULL REFERENCES employees(id),
 expires_at timestamptz NOT NULL, revoked boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS uploads (
 id text PRIMARY KEY, employee_id bigint NOT NULL REFERENCES employees(id),
 filename text NOT NULL UNIQUE, mime text NOT NULL, bytes integer NOT NULL,
 width integer NOT NULL, height integer NOT NULL, sha256 text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS requests (
 id bigserial PRIMARY KEY, employee_id bigint NOT NULL REFERENCES employees(id),
 project_id bigint NOT NULL REFERENCES projects(id), operation_key text NOT NULL,
 payload_hash text NOT NULL, kind text NOT NULL CHECK(kind IN ('bug','feature')),
 title text NOT NULL, description text NOT NULL, reproduction text NOT NULL,
 page_url text NOT NULL, viewport_width integer NOT NULL, viewport_height integer NOT NULL,
 reported_impact text NOT NULL, upload_id text UNIQUE REFERENCES uploads(id),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(employee_id,operation_key)
);
CREATE TABLE IF NOT EXISTS investigations (
 id bigserial PRIMARY KEY, request_id bigint NOT NULL UNIQUE REFERENCES requests(id),
 state text NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','cancelled')),
 confirmed boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS tickets (
 id bigserial PRIMARY KEY, request_id bigint NOT NULL UNIQUE REFERENCES requests(id),
 investigation_id bigint NOT NULL UNIQUE REFERENCES investigations(id),
 state text NOT NULL DEFAULT 'QUEUED' CHECK(state IN ('QUEUED','CANCELLED')),
 priority integer NOT NULL CHECK(priority BETWEEN 0 AND 3), rule_id text NOT NULL,
 priority_reason text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS events (
 id bigserial PRIMARY KEY, ticket_id bigint NOT NULL REFERENCES tickets(id),
 actor_id bigint NOT NULL REFERENCES employees(id), type text NOT NULL,
 message text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS notifications (
 id bigserial PRIMARY KEY, employee_id bigint NOT NULL REFERENCES employees(id),
 ticket_id bigint NOT NULL REFERENCES tickets(id), operation_key text UNIQUE NOT NULL,
 message text NOT NULL, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tickets_queue ON tickets(state,priority,created_at,id);
INSERT INTO projects(id,name) VALUES(1,'Team Tasks') ON CONFLICT DO NOTHING;
