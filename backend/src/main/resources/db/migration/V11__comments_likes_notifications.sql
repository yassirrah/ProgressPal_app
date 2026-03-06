CREATE TABLE session_comment (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES session(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    CONSTRAINT ck_session_comment_content_not_blank CHECK (length(trim(content)) > 0)
);

CREATE INDEX ix_session_comment_session_created
    ON session_comment (session_id, created_at DESC);

CREATE INDEX ix_session_comment_author_created
    ON session_comment (author_id, created_at DESC);

CREATE TABLE session_reaction (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES session(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_session_reaction_type CHECK (type IN ('LIKE'))
);

CREATE UNIQUE INDEX ux_session_reaction_unique
    ON session_reaction (session_id, user_id, type);

CREATE INDEX ix_session_reaction_session_type
    ON session_reaction (session_id, type);

CREATE TABLE notification (
    id UUID PRIMARY KEY,
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(40) NOT NULL,
    resource_type VARCHAR(40),
    resource_id UUID,
    message VARCHAR(255) NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_notification_type CHECK (
        type IN ('FRIEND_REQUEST_RECEIVED', 'FRIEND_REQUEST_ACCEPTED', 'SESSION_COMMENT', 'SESSION_LIKE')
    ),
    CONSTRAINT ck_notification_resource_type CHECK (
        resource_type IS NULL OR resource_type IN ('FRIEND_REQUEST', 'SESSION', 'COMMENT', 'REACTION')
    )
);

CREATE INDEX ix_notification_recipient_created
    ON notification (recipient_id, created_at DESC);

CREATE INDEX ix_notification_recipient_unread
    ON notification (recipient_id, read_at);
