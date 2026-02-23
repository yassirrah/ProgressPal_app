ALTER TABLE activity_type
    ADD COLUMN metric_kind VARCHAR(20) NOT NULL DEFAULT 'NONE',
    ADD COLUMN metric_label VARCHAR(80);

ALTER TABLE activity_type
    ADD CONSTRAINT chk_activity_type_metric_kind
        CHECK (metric_kind IN ('NONE', 'INTEGER', 'DECIMAL'));
