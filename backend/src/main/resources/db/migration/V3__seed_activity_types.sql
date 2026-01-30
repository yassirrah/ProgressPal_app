INSERT INTO activity_type (id, name, icon_url, is_custom, created_by) VALUES
                              ('11111111-1111-1111-1111-111111111111', 'Study',   NULL, false, NULL),
                              ('22222222-2222-2222-2222-222222222222', 'Coding',  NULL, false, NULL),
                              ('33333333-3333-3333-3333-333333333333', 'Reading', NULL, false, NULL),
                              ('44444444-4444-4444-4444-444444444444', 'Gym',     NULL, false, NULL),
                              ('55555555-5555-5555-5555-555555555555', 'Walking', NULL, false, NULL)
    ON CONFLICT DO NOTHING;
