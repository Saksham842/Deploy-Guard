const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ─── Connection test ─────────────────────────────────────────────────────────
pool.on('error', (err) => console.error('[pg] Unexpected pool error', err));

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
  const { rows } = await pool.query(`SELECT * FROM repos ORDER BY created_at DESC`);
  return rows;
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
 */
async function saveCheck({ repoId, prNumber, headSha, baseSha, status, results, causes = [] }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows: checkRows } = await client.query(
      `INSERT INTO checks (repo_id, pr_number, head_sha, base_sha, status, results)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [repoId, prNumber, headSha, baseSha, status, JSON.stringify(results)]
    );
    const checkId = checkRows[0].id;

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

// ─── Threshold config ─────────────────────────────────────────────────────────

async function getThresholds(repoId) {
  const { rows } = await pool.query(
    `SELECT threshold_config FROM repos WHERE id = $1`,
    [repoId]
  );
  return rows[0]?.threshold_config ?? { bundle_kb: 10, query_count: 20, api_p95_ms: 200 };
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
  getBaseline,
  upsertBaseline,
  saveCheck,
  updateCheckStatus,
  getRepoChecks,
  getThresholds,
  updateThresholds,
  upsertUser,
  getUserByGithubId,
};
