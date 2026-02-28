ALTER TABLE session
    ADD COLUMN goal_type VARCHAR(16) NOT NULL DEFAULT 'NONE',
    ADD COLUMN goal_target NUMERIC(19,4),
    ADD COLUMN goal_note VARCHAR(255);

ALTER TABLE session
    ADD CONSTRAINT ck_session_goal_type
        CHECK (goal_type IN ('NONE', 'TIME', 'METRIC'));

ALTER TABLE session
    ADD CONSTRAINT ck_session_goal_target_positive
        CHECK (goal_target IS NULL OR goal_target > 0);
