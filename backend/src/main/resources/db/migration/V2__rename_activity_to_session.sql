-- 1) Create visibility enum once
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'visibility') THEN
CREATE TYPE visibility AS ENUM ('PUBLIC','FOLLOWERS','PRIVATE');
END IF;
END $$;

-- 2) activity_type uniqueness (defaults vs user-custom)
ALTER TABLE activity_type ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE IF EXISTS activity_type
DROP CONSTRAINT IF EXISTS activity_type_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS ux_activity_type_defaults
    ON activity_type (name) WHERE created_by IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_activity_type_custom_per_user
    ON activity_type (created_by, name);

-- 3) Rename activity -> session (table exists from V1)
ALTER TABLE IF EXISTS activity RENAME TO session;

-- 4) Convert visibility (text) -> enum, step by step
ALTER TABLE session ADD COLUMN visibility_new visibility;

UPDATE session
SET visibility_new = CASE UPPER(visibility)
                         WHEN 'PUBLIC'     THEN 'PUBLIC'::visibility
                         WHEN 'FRIENDS'    THEN 'FOLLOWERS'::visibility
                         WHEN 'FOLLOWERS'  THEN 'FOLLOWERS'::visibility
                         WHEN 'PRIVATE'    THEN 'PRIVATE'::visibility
                         ELSE 'PUBLIC'::visibility
    END;

ALTER TABLE session DROP COLUMN visibility;

ALTER TABLE session RENAME COLUMN visibility_new TO visibility;

-- 5) Drop redundant flag (live = ended_at IS NULL)
ALTER TABLE session DROP COLUMN IF EXISTS is_ongoing;

-- 6) Constraints & indexes
ALTER TABLE session
    ALTER COLUMN started_at SET NOT NULL;

ALTER TABLE session
    ADD CONSTRAINT session_time_order
        CHECK (ended_at IS NULL OR ended_at >= started_at);

CREATE INDEX IF NOT EXISTS ix_session_user_started
    ON session (user_id, started_at DESC);

CREATE INDEX IF NOT EXISTS ix_session_type_started
    ON session (activity_type_id, started_at DESC);
