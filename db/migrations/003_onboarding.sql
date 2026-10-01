-- DeployGuard — Migration 003: Onboarding Automation & Build Tool Tracking
-- Run: psql $DATABASE_URL -f db/migrations/003_onboarding.sql

ALTER TABLE repos ADD COLUMN IF NOT EXISTS build_tool TEXT;
ALTER TABLE repos ADD COLUMN IF NOT EXISTS setup_pr_url TEXT;
ALTER TABLE repos ADD COLUMN IF NOT EXISTS setup_status TEXT DEFAULT 'pending';

CREATE INDEX IF NOT EXISTS idx_repos_setup_status ON repos(setup_status);
