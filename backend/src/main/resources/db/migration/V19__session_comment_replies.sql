ALTER TABLE session_comment
    ADD COLUMN parent_comment_id UUID;

ALTER TABLE session_comment
    ADD CONSTRAINT fk_session_comment_parent
        FOREIGN KEY (parent_comment_id)
        REFERENCES session_comment(id)
        ON DELETE CASCADE;

CREATE INDEX ix_session_comment_parent_created
    ON session_comment (parent_comment_id, created_at ASC)
    WHERE parent_comment_id IS NOT NULL;
