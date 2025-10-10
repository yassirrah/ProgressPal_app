-- === users =========================================================
CREATE TABLE users (
                       id            UUID PRIMARY KEY,
                       username      VARCHAR(50)  NOT NULL UNIQUE,
                       email         VARCHAR(100) NOT NULL UNIQUE,
                       password      VARCHAR(255) NOT NULL,
                       profile_image TEXT,
                       bio           TEXT,
                       created_at    TIMESTAMPTZ  DEFAULT NOW(),
                       updated_at    TIMESTAMPTZ
);

-- === activity_type ================================================
CREATE TABLE activity_type (
                               id          UUID PRIMARY KEY,
                               name        VARCHAR(60) NOT NULL UNIQUE,
                               icon_url    TEXT,
                               is_custom   BOOLEAN NOT NULL,
                               created_by  UUID REFERENCES users(id)
);

-- === activity ======================================================
CREATE TABLE activity (
                          id               UUID PRIMARY KEY,
                          user_id          UUID NOT NULL REFERENCES users(id),
                          activity_type_id UUID NOT NULL REFERENCES activity_type(id),
                          title            VARCHAR(120),
                          description      TEXT,
                          started_at       TIMESTAMPTZ NOT NULL,
                          ended_at         TIMESTAMPTZ,
                          visibility       VARCHAR(10) NOT NULL,      -- public / friends / private
                          is_ongoing       BOOLEAN     NOT NULL DEFAULT TRUE
);
