INSERT INTO ai_api_keys (provider, label, api_key, is_active, usage_count, error_count)
VALUES ('lovable', 'Lovable Gateway', 'ENV_MANAGED', true, 0, 0)
ON CONFLICT DO NOTHING;