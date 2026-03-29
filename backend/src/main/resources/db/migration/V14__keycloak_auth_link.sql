ALTER TABLE users
    ALTER COLUMN password DROP NOT NULL;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50),
    ADD COLUMN IF NOT EXISTS auth_subject VARCHAR(255),
    ADD COLUMN IF NOT EXISTS auth_issuer VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS ux_users_auth_link
    ON users (auth_issuer, auth_subject)
    WHERE auth_issuer IS NOT NULL AND auth_subject IS NOT NULL;
