DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_type t
                 JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'visibility'
          AND e.enumlabel = 'FOLLOWERS'
    ) AND NOT EXISTS (
        SELECT 1
        FROM pg_type t
                 JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'visibility'
          AND e.enumlabel = 'FRIENDS'
    ) THEN
        ALTER TYPE visibility RENAME VALUE 'FOLLOWERS' TO 'FRIENDS';
    ELSIF NOT EXISTS (
        SELECT 1
        FROM pg_type t
                 JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'visibility'
          AND e.enumlabel = 'FRIENDS'
    ) THEN
        ALTER TYPE visibility ADD VALUE 'FRIENDS';
    END IF;
END $$;
