ALTER TABLE session
    ADD COLUMN metric_current_value NUMERIC(19,4);

ALTER TABLE session
    ADD CONSTRAINT ck_session_metric_current_value_non_negative
        CHECK (metric_current_value IS NULL OR metric_current_value >= 0);
