const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── Connection test & Auto-migration ───────────────────────────────────────
pool.on('error', (err) => console.error('[pg] Unexpected pool error', err));

pool.query(`
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  CREATE TABLE IF NOT EXISTS repos (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    github_repo_id   BIGINT UNIQUE NOT NULL,
    owner            TEXT NOT NULL,
    name             TEXT NOT NULL,
    install_id       BIGINT NOT NULL,
    threshold_config JSONB NOT NULL DEFAULT '{"bundle_kb":10,"query_count":20,"api_p95_ms":200,"query_tracking_enabled":false}',
    created_at       TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS baselines (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repo_id     UUID REFERENCES repos(id) ON DELETE CASCADE,
    branch      TEXT NOT NULL,
    metric      TEXT NOT NULL,
    value       NUMERIC NOT NULL,
    commit_sha  TEXT NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(repo_id, branch, metric)
  );

  CREATE TABLE IF NOT EXISTS checks (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    repo_id            UUID REFERENCES repos(id) ON DELETE CASCADE,
    pr_number          INT NOT NULL,
    head_sha           TEXT NOT NULL,
    base_sha           TEXT NOT NULL,
    status             TEXT NOT NULL DEFAULT 'pending',
    results            JSONB,
    github_delivery_id TEXT,
    created_at         TIMESTAMPTZ DEFAULT NOW()
  );

  ALTER TABLE checks ADD COLUMN IF NOT EXISTS github_delivery_id TEXT;

  DO $$ BEGIN
    ALTER TABLE checks ADD CONSTRAINT uniq_repo_pr_sha UNIQUE (repo_id, pr_number, head_sha);
  EXCEPTION
    WHEN duplicate_table OR duplicate_object THEN NULL;
  END $$;

  CREATE TABLE IF NOT EXISTS regression_causes (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    check_id    UUID REFERENCES checks(id) ON DELETE CASCADE,
    cause_type  TEXT NOT NULL,
    detail      TEXT,
    confidence  NUMERIC,
    created_at  TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS users (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    github_user_id BIGINT UNIQUE NOT NULL,
    username       TEXT NOT NULL,
    avatar_url     TEXT,
    access_token   TEXT,
    created_at     TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_baselines_repo_branch ON baselines(repo_id, branch);
  CREATE INDEX IF NOT EXISTS idx_checks_repo_pr       ON checks(repo_id, pr_number);
  CREATE INDEX IF NOT EXISTS idx_checks_repo_created  ON checks(repo_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_checks_delivery      ON checks(github_delivery_id);
  CREATE INDEX IF NOT EXISTS idx_causes_check         ON regression_causes(check_id);

  -- Phase 1: onboarding columns (safe to add after initial table creation)
  ALTER TABLE repos ADD COLUMN IF NOT EXISTS build_tool    TEXT;
  ALTER TABLE repos ADD COLUMN IF NOT EXISTS setup_pr_url  TEXT;
  ALTER TABLE repos ADD COLUMN IF NOT EXISTS setup_status  TEXT DEFAULT 'pending';
`).then(() => {
  console.log('[pg] Database tables initialized successfully.');
}).catch(err => {
  console.error('[pg] Failed to initialize tables:', err.message);
});

// ─── Repos ───────────────────────────────────────────────────────────────────

/**
 * Upsert a repo record by its GitHub repo ID.
 * Returns the internal UUID.
 */
async function getOrCreateRepo(githubRepoId, owner, name, installId) {
  const { rows } = await pool.query(
    `INSERT INTO repos (github_repo_id, owner, name, install_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (github_repo_id)
     DO UPDATE SET install_id = EXCLUDED.install_id,
                   owner      = EXCLUDED.owner,
                   name       = EXCLUDED.name
     RETURNING *`,
    [githubRepoId, owner, name, installId]
  );
  return rows[0];
}

async function getRepoByGithubId(githubRepoId) {
  const { rows } = await pool.query(
    `SELECT * FROM repos WHERE github_repo_id = $1`,
    [githubRepoId]
  );
  return rows[0] || null;
}

async function listRepos() {
  const { rows } = await pool.query(`
    SELECT r.*,
      (
        SELECT row_to_json(c)
        FROM checks c
        WHERE c.repo_id = r.id
        ORDER BY c.created_at DESC
        LIMIT 1
      ) AS last_check,
      (
        SELECT count(*)::int
        FROM checks c
        WHERE c.repo_id = r.id
      ) AS check_count
    FROM repos r
    ORDER BY r.created_at DESC
  `);
  return rows;
}

/**
 * Update setup onboarding state for a repo.
 * Called after a setup PR is created or merged.
 *
 * @param {string} repoId     - Internal UUID
 * @param {object} fields     - { build_tool?, setup_pr_url?, setup_status? }
 */
async function updateRepoSetup(repoId, fields) {
  const { build_tool, setup_pr_url, setup_status } = fields;
  await pool.query(
    `UPDATE repos
     SET build_tool   = COALESCE($1, build_tool),
         setup_pr_url = COALESCE($2, setup_pr_url),
         setup_status = COALESCE($3, setup_status)
     WHERE id = $4`,
    [build_tool ?? null, setup_pr_url ?? null, setup_status ?? null, repoId]
  );
}

/**
 * Delete all repos associated with an installation ID (when app is uninstalled).
 * Cascades to checks and baselines automatically.
 */
async function deleteReposByInstallId(installId) {
  const { rowCount } = await pool.query('DELETE FROM repos WHERE install_id = $1', [installId]);
  return rowCount;
}

/**
 * Delete a single repo by its GitHub repository ID (when removed from installation).
 * Cascades to checks and baselines automatically.
 */
async function deleteRepoByGithubId(githubRepoId) {
  const { rowCount } = await pool.query('DELETE FROM repos WHERE github_repo_id = $1', [githubRepoId]);
  return rowCount;
}

// ─── Baselines ───────────────────────────────────────────────────────────────

/**
 * Fetch the stored baseline for a repo + branch + metric.
 * Returns { value, commit_sha } or null if no baseline exists yet.
 */
async function getBaseline(repoId, branch, metric) {
  const { rows } = await pool.query(
    `SELECT value, commit_sha, recorded_at
     FROM baselines
     WHERE repo_id = $1 AND branch = $2 AND metric = $3`,
    [repoId, branch, metric]
  );
  return rows[0] || null;
}

/**
 * Insert or update a baseline snapshot.
 * Only called when a PR passes and merges to main/master.
 */
async function upsertBaseline(repoId, branch, metric, value, commitSha) {
  await pool.query(
    `INSERT INTO baselines (repo_id, branch, metric, value, commit_sha)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (repo_id, branch, metric)
     DO UPDATE SET value = EXCLUDED.value,
                   commit_sha = EXCLUDED.commit_sha,
                   recorded_at = NOW()`,
    [repoId, branch, metric, value, commitSha]
  );
}

// ─── Checks ──────────────────────────────────────────────────────────────────

/**
 * Persist a completed check along with its regression causes.
 * Wraps in a transaction so causes are never orphaned.
 * Uses ON CONFLICT to remain idempotent on webhook retries.
 */
async function saveCheck({ repoId, prNumber, headSha, baseSha, status, results, causes = [], githubDeliveryId = null }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: checkRows } = await client.query(
      `INSERT INTO checks (repo_id, pr_number, head_sha, base_sha, status, results, github_delivery_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (repo_id, pr_number, head_sha)
       DO UPDATE SET status = EXCLUDED.status,
                     results = EXCLUDED.results,
                     github_delivery_id = COALESCE(EXCLUDED.github_delivery_id, checks.github_delivery_id)
       RETURNING id`,
      [repoId, prNumber, headSha, baseSha, status, JSON.stringify(results), githubDeliveryId]
    );
    const checkId = checkRows[0].id;

    // Clear previous causes for this check before inserting to prevent duplicates on upsert
    await client.query('DELETE FROM regression_causes WHERE check_id = $1', [checkId]);

    for (const cause of causes) {
      await client.query(
        `INSERT INTO regression_causes (check_id, cause_type, detail, confidence)
         VALUES ($1, $2, $3, $4)`,
        [checkId, cause.cause_type, cause.detail, cause.confidence]
      );
    }

    await client.query('COMMIT');
    return checkId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Fetch a check by its GitHub delivery ID.
 */
async function getCheckByDeliveryId(deliveryId) {
  if (!deliveryId) return null;
  const { rows } = await pool.query(
    `SELECT * FROM checks WHERE github_delivery_id = $1 LIMIT 1`,
    [deliveryId]
  );
  return rows[0] || null;
}

/**
 * Fetch a check by repo, PR number, and head SHA.
 */
async function getCheckByRepoPrSha(repoId, prNumber, headSha) {
  const { rows } = await pool.query(
    `SELECT * FROM checks WHERE repo_id = $1 AND pr_number = $2 AND head_sha = $3 LIMIT 1`,
    [repoId, prNumber, headSha]
  );
  return rows[0] || null;
}

/**
 * Update status of an in-progress check (e.g., from pending → pass/fail/error).
 */
async function updateCheckStatus(checkId, status, results = null) {
  await pool.query(
    `UPDATE checks SET status = $1, results = COALESCE($2, results) WHERE id = $3`,
    [status, results ? JSON.stringify(results) : null, checkId]
  );
}

/**
 * Fetch the last N checks for a repo, newest first.
 */
async function getRepoChecks(repoId, limit = 20) {
  const { rows } = await pool.query(
    `SELECT c.*, 
       COALESCE(json_agg(rc.*) FILTER (WHERE rc.id IS NOT NULL), '[]') AS causes
     FROM checks c
     LEFT JOIN regression_causes rc ON rc.check_id = c.id
     WHERE c.repo_id = $1
     GROUP BY c.id
     ORDER BY c.created_at DESC
     LIMIT $2`,
    [repoId, limit]
  );
  return rows;
}

/**
 * Trend detection: queries last 10 checks for this repo, checks the last 5 failing checks,
 * and flags if any cause appears in >= 3 of the last 5 failing checks.
 */
async function getRepoTrendWarning(repoId) {
  const { rows } = await pool.query(
    `WITH recent_checks AS (
       SELECT id, status, created_at
       FROM checks
       WHERE repo_id = $1
       ORDER BY created_at DESC
       LIMIT 10
     ),
     recent_fails AS (
       SELECT id
       FROM recent_checks
       WHERE status = 'fail'
       ORDER BY created_at DESC
       LIMIT 5
     )
     SELECT rc.cause_type, COUNT(*)::int AS count
     FROM regression_causes rc
     JOIN recent_fails rf ON rf.id = rc.check_id
     GROUP BY rc.cause_type
     HAVING COUNT(*) >= 3
     ORDER BY count DESC
     LIMIT 1`,
    [repoId]
  );

  if (rows.length > 0) {
    const { cause_type, count } = rows[0];
    return {
      detected: true,
      cause_type,
      count,
      message: `Recurring regression pattern: "${cause_type}" appeared in ${count} of the last failing checks.`,
    };
  }

  return {
    detected: false,
    cause_type: null,
    count: 0,
    message: null,
  };
}

/**
 * Retrieve the most recent chunkDiff stored in checks.results.
 */
async function getLatestChunkDiff(repoId) {
  const { rows } = await pool.query(
    `SELECT results->'chunkDiff' AS chunk_diff
     FROM checks
     WHERE repo_id = $1 AND results ? 'chunkDiff'
     ORDER BY created_at DESC
     LIMIT 1`,
    [repoId]
  );
  return rows[0]?.chunk_diff || [];
}

// ─── Threshold config ─────────────────────────────────────────────────────────

async function getThresholds(repoId) {
  const { rows } = await pool.query(
    `SELECT threshold_config FROM repos WHERE id = $1`,
    [repoId]
  );
  return rows[0]?.threshold_config ?? { bundle_kb: 10, query_count: 20, api_p95_ms: 200, query_tracking_enabled: false };
}

async function updateThresholds(repoId, thresholds) {
  const { rows } = await pool.query(
    `UPDATE repos SET threshold_config = $1 WHERE id = $2 RETURNING threshold_config`,
    [JSON.stringify(thresholds), repoId]
  );
  return rows[0]?.threshold_config;
}

// ─── Users (OAuth) ────────────────────────────────────────────────────────────

async function upsertUser({ githubUserId, username, avatarUrl, accessToken }) {
  const { rows } = await pool.query(
    `INSERT INTO users (github_user_id, username, avatar_url, access_token)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (github_user_id)
     DO UPDATE SET username = EXCLUDED.username,
                   avatar_url = EXCLUDED.avatar_url,
                   access_token = EXCLUDED.access_token
     RETURNING *`,
    [githubUserId, username, avatarUrl, accessToken]
  );
  return rows[0];
}

async function getUserByGithubId(githubUserId) {
  const { rows } = await pool.query(
    `SELECT * FROM users WHERE github_user_id = $1`,
    [githubUserId]
  );
  return rows[0] || null;
}

module.exports = {
  pool,
  getOrCreateRepo,
  getRepoByGithubId,
  listRepos,
  updateRepoSetup,
  deleteReposByInstallId,
  deleteRepoByGithubId,
  getBaseline,
  upsertBaseline,
  saveCheck,
  getCheckByDeliveryId,
  getCheckByRepoPrSha,
  updateCheckStatus,
  getRepoChecks,
  getRepoTrendWarning,
  getLatestChunkDiff,
  getThresholds,
  updateThresholds,
  upsertUser,
  getUserByGithubId,
};
