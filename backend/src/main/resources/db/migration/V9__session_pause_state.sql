ALTER TABLE session
    ADD COLUMN paused_at TIMESTAMPTZ;

ALTER TABLE session
    ADD COLUMN paused_duration_seconds BIGINT NOT NULL DEFAULT 0;

ALTER TABLE session
    ADD CONSTRAINT ck_session_paused_duration_non_negative
        CHECK (paused_duration_seconds >= 0);
