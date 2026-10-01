-- DeployGuard — Migration 002: Webhook Idempotency & Delivery Tracking
-- Run: psql $DATABASE_URL -f db/migrations/002_idempotency.sql

-- 1. Add github_delivery_id column for webhook delivery tracking
ALTER TABLE checks ADD COLUMN IF NOT EXISTS github_delivery_id TEXT;

-- 2. Index for rapid delivery lookup
CREATE INDEX IF NOT EXISTS idx_checks_delivery ON checks(github_delivery_id);

-- 3. Unique constraint to ensure idempotency per repo + PR + head commit SHA
DO $$
BEGIN
  ALTER TABLE checks ADD CONSTRAINT uniq_repo_pr_sha UNIQUE (repo_id, pr_number, head_sha);
EXCEPTION
  WHEN duplicate_table OR duplicate_object THEN NULL;
END $$;
