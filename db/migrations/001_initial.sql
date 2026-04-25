-- DeployGuard — Initial Schema Migration
-- Run: psql $DATABASE_URL -f db/migrations/001_initial.sql

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Repos ───────────────────────────────────────────────────────────────────
-- One row per connected GitHub repository (per installation)
CREATE TABLE IF NOT EXISTS repos (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  github_repo_id   BIGINT UNIQUE NOT NULL,
  owner            TEXT NOT NULL,
  name             TEXT NOT NULL,
  install_id       BIGINT NOT NULL,
  threshold_config JSONB NOT NULL DEFAULT '{"bundle_kb":10,"query_count":20,"api_p95_ms":200}',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Baselines ───────────────────────────────────────────────────────────────
-- Performance snapshots per repo × branch × metric.
-- Updated only when a PR merges into main/master and passes.
CREATE TABLE IF NOT EXISTS baselines (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repo_id     UUID REFERENCES repos(id) ON DELETE CASCADE,
  branch      TEXT NOT NULL,
  metric      TEXT NOT NULL,        -- "bundle_kb" | "query_count" | "api_p95_ms"
  value       NUMERIC NOT NULL,
  commit_sha  TEXT NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(repo_id, branch, metric)
);

-- ─── Checks ──────────────────────────────────────────────────────────────────
-- One row per PR check run.
CREATE TABLE IF NOT EXISTS checks (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repo_id     UUID REFERENCES repos(id) ON DELETE CASCADE,
  pr_number   INT NOT NULL,
  head_sha    TEXT NOT NULL,
  base_sha    TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending|pass|fail|error
  results     JSONB,   -- {bundle_kb:{before,after,delta}, query_count:{...}, api_p95_ms:{...}}
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Regression Causes ───────────────────────────────────────────────────────
-- NLP + diff causal explanations per check.
CREATE TABLE IF NOT EXISTS regression_causes (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  check_id    UUID REFERENCES checks(id) ON DELETE CASCADE,
  cause_type  TEXT NOT NULL,   -- "new_dependency"|"asset_added"|"feature"|"refactor"|"chore"|"unknown"
  detail      TEXT,
  confidence  NUMERIC,         -- 0.0 to 1.0
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Users ───────────────────────────────────────────────────────────────────
-- Dashboard users authenticated via GitHub OAuth.
CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  github_user_id BIGINT UNIQUE NOT NULL,
  username       TEXT NOT NULL,
  avatar_url     TEXT,
  access_token   TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_baselines_repo_branch ON baselines(repo_id, branch);
CREATE INDEX IF NOT EXISTS idx_checks_repo_pr       ON checks(repo_id, pr_number);
CREATE INDEX IF NOT EXISTS idx_checks_repo_created  ON checks(repo_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_causes_check         ON regression_causes(check_id);
