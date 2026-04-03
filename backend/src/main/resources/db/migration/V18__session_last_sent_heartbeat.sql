ALTER TABLE session
    ADD COLUMN IF NOT EXISTS last_sent_heartbeat TIMESTAMPTZ;
