ALTER TABLE notification
    DROP CONSTRAINT IF EXISTS ck_notification_type;

ALTER TABLE notification
    ADD CONSTRAINT ck_notification_type CHECK (
        type IN (
            'FRIEND_REQUEST_RECEIVED',
            'FRIEND_REQUEST_ACCEPTED',
            'SESSION_JOIN_REQUEST_ACCEPTED',
            'SESSION_COMMENT',
            'SESSION_LIKE',
            'SESSION_STARTED'
        )
    );
