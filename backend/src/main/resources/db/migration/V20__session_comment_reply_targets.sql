ALTER TABLE session_comment
    ADD COLUMN reply_to_comment_id UUID;

ALTER TABLE session_comment
    ADD CONSTRAINT fk_session_comment_reply_to
        FOREIGN KEY (reply_to_comment_id)
        REFERENCES session_comment(id)
        ON DELETE SET NULL;

CREATE INDEX ix_session_comment_reply_to_created
    ON session_comment (reply_to_comment_id, created_at ASC)
    WHERE reply_to_comment_id IS NOT NULL;
