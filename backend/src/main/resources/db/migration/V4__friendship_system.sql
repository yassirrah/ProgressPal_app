-- === friend_request =================================================
CREATE TABLE friend_request (
                                id           UUID PRIMARY KEY,
                                requester_id UUID NOT NULL REFERENCES users(id),
                                receiver_id  UUID NOT NULL REFERENCES users(id),
                                status       VARCHAR(20) NOT NULL,
                                created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                                CONSTRAINT chk_friend_request_status
                                    CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')),

                                CONSTRAINT chk_friend_request_not_self
                                    CHECK (requester_id <> receiver_id)
);

-- Block duplicate pending requests in both directions
CREATE UNIQUE INDEX ux_friend_request_pending_pair
    ON friend_request (LEAST(requester_id, receiver_id), GREATEST(requester_id, receiver_id))
    WHERE status = 'PENDING';

CREATE INDEX ix_friend_request_requester_created
    ON friend_request (requester_id, created_at DESC);

CREATE INDEX ix_friend_request_receiver_created
    ON friend_request (receiver_id, created_at DESC);

-- === friendship =====================================================
CREATE TABLE friendship (
                            id         UUID PRIMARY KEY,
                            user_id    UUID NOT NULL REFERENCES users(id),
                            friend_id  UUID NOT NULL REFERENCES users(id),
                            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                            CONSTRAINT chk_friendship_not_self
                                CHECK (user_id <> friend_id)
);

-- Enforce one friendship pair regardless of direction (A,B) == (B,A)
CREATE UNIQUE INDEX ux_friendship_pair
    ON friendship (LEAST(user_id, friend_id), GREATEST(user_id, friend_id));

CREATE INDEX ix_friendship_user_created
    ON friendship (user_id, created_at DESC);

CREATE INDEX ix_friendship_friend_created
    ON friendship (friend_id, created_at DESC);
