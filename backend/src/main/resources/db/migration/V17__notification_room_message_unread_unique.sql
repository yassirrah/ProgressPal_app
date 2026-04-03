WITH ranked_unread_room_notifications AS (
    SELECT id,
           row_number() OVER (
               PARTITION BY recipient_id, type, resource_type, resource_id
               ORDER BY created_at DESC, id DESC
           ) AS row_number
    FROM notification
    WHERE type = 'SESSION_ROOM_MESSAGE_RECEIVED'
      AND resource_type = 'SESSION'
      AND read_at IS NULL
)
DELETE FROM notification notification_to_delete
USING ranked_unread_room_notifications ranked_notification
WHERE notification_to_delete.id = ranked_notification.id
  AND ranked_notification.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS ux_notification_room_message_unread_per_session
    ON notification (recipient_id, type, resource_type, resource_id)
    WHERE type = 'SESSION_ROOM_MESSAGE_RECEIVED'
      AND resource_type = 'SESSION'
      AND read_at IS NULL;
