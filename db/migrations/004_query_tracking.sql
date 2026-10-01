-- DeployGuard — Migration 004: Query Tracking Opt-In & Threshold Configuration
-- Run: psql $DATABASE_URL -f db/migrations/004_query_tracking.sql

-- Ensure threshold_config JSONB has query_tracking_enabled: false by default
UPDATE repos
SET threshold_config = jsonb_set(
  threshold_config,
  '{query_tracking_enabled}',
  'false'::jsonb,
  true
)
WHERE threshold_config->>'query_tracking_enabled' IS NULL;
