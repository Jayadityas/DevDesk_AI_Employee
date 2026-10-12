ALTER TABLE scope_proposals ADD COLUMN IF NOT EXISTS profile text NOT NULL DEFAULT 'frontend' CHECK(profile IN('frontend','backend'));
ALTER TABLE repair_runs ADD COLUMN IF NOT EXISTS profile text NOT NULL DEFAULT 'frontend' CHECK(profile IN('frontend','backend'));
ALTER TABLE integration_runs ADD COLUMN IF NOT EXISTS profile text NOT NULL DEFAULT 'frontend' CHECK(profile IN('frontend','backend'));
