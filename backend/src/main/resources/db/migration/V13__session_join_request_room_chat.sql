CREATE TABLE session_join_request (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES session(id) ON DELETE CASCADE,
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at TIMESTAMPTZ,
    CONSTRAINT ux_session_join_request_session_requester UNIQUE (session_id, requester_id),
    CONSTRAINT ck_session_join_request_status CHECK (
        status IN ('PENDING', 'ACCEPTED', 'REJECTED')
    )
);

CREATE INDEX ix_session_join_request_requester_created
    ON session_join_request (requester_id, created_at DESC);

CREATE INDEX ix_session_join_request_session_status_created
    ON session_join_request (session_id, status, created_at DESC);

CREATE TABLE session_room_message (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES session(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content VARCHAR(1000) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_session_room_message_content_not_blank CHECK (
        length(trim(content)) > 0
    )
);

CREATE INDEX ix_session_room_message_session_created
    ON session_room_message (session_id, created_at DESC);

CREATE INDEX ix_session_room_message_sender_created
    ON session_room_message (sender_id, created_at DESC);
