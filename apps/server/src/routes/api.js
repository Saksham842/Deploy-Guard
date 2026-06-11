const express = require('express');
const axios   = require('axios');
const {
  listRepos,
  getRepoByGithubId,
  getRepoChecks,
  getThresholds,
  updateThresholds,
  upsertUser,
} = require('../db');

const router = express.Router();

// ─── Auth middleware ───────────────────────────────────────────────────────────
// Simple token-based auth — the dashboard sends the GitHub access token in the
// Authorization header, and we validate it by calling /user on the GitHub API.
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Missing Authorization header' });

  try {
    const { data: ghUser } = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `token ${token}` },
    });
    req.githubUser = ghUser;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid GitHub token' });
  }
}

// ─── GitHub OAuth ─────────────────────────────────────────────────────────────

/**
 * GET /auth/github
 * Redirect the browser to GitHub OAuth authorization page.
 */
router.get('/auth/github', (_req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID,
    scope: 'read:user',
    redirect_uri: `${(process.env.BACKEND_URL || 'http://localhost:3000').replace(/\/+$/, '')}/api/auth/github/callback`,
  });
  res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

/**
 * GET /auth/github/callback
 * Exchange code for access token, upsert user, return token to dashboard.
 */
router.get('/auth/github/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'Missing code' });

  try {
    // Exchange code for access token
    const tokenRes = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id:     process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      { headers: { Accept: 'application/json' } }
    );
    const { access_token } = tokenRes.data;
    if (!access_token) return res.status(400).json({ error: 'OAuth exchange failed', data: tokenRes.data });

    // Fetch GitHub user profile
    const { data: ghUser } = await axios.get('https://api.github.com/user', {
      headers: { Authorization: `token ${access_token}` },
    });

    // Persist user
    await upsertUser({
      githubUserId: ghUser.id,
      username:     ghUser.login,
      avatarUrl:    ghUser.avatar_url,
      accessToken:  access_token,
    });

    let frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    if (typeof frontendUrl === 'string') {
      frontendUrl = frontendUrl.trim().replace(/^['"]|['"]$/g, '');
      if (!frontendUrl.startsWith('http://') && !frontendUrl.startsWith('https://')) {
        frontendUrl = `https://${frontendUrl}`;
      }
    }
    res.redirect(`${frontendUrl}/auth/callback?token=${access_token}&username=${ghUser.login}&avatar=${encodeURIComponent(ghUser.avatar_url)}`);
  } catch (err) {
    console.error('[oauth] Callback error full details:', err.response?.data || err);
    res.status(500).json({ error: 'OAuth callback failed', details: err.response?.data || err.message || err.toString() });
  }
});

// ─── Repos ────────────────────────────────────────────────────────────────────

/** GET /api/repos — list all connected repos */
router.get('/repos', requireAuth, async (_req, res) => {
  try {
    const repos = await listRepos();
    res.json(repos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/repos/:owner/:name/checks — recent checks for a repo */
router.get('/repos/:owner/:name/checks', requireAuth, async (req, res) => {
  try {
    const repo = await getRepoByGithubId(null); // lookup by owner/name below
    // Find repo by owner + name
    const { pool } = require('../db');
    const { rows } = await pool.query(
      `SELECT * FROM repos WHERE owner = $1 AND name = $2 LIMIT 1`,
      [req.params.owner, req.params.name]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Repo not found' });

    const checks = await getRepoChecks(rows[0].id, 30);
    res.json({ repo: rows[0], checks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/repos/:owner/:name/thresholds — get threshold config */
router.get('/repos/:owner/:name/thresholds', requireAuth, async (req, res) => {
  try {
    const { pool } = require('../db');
    const { rows } = await pool.query(
      `SELECT id, threshold_config FROM repos WHERE owner = $1 AND name = $2 LIMIT 1`,
      [req.params.owner, req.params.name]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Repo not found' });
    res.json(rows[0].threshold_config);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/repos/:owner/:name/thresholds — update threshold config */
router.put('/repos/:owner/:name/thresholds', requireAuth, async (req, res) => {
  try {
    const { bundle_kb, query_count, api_p95_ms } = req.body;
    const { pool } = require('../db');
    const { rows } = await pool.query(
      `SELECT id FROM repos WHERE owner = $1 AND name = $2 LIMIT 1`,
      [req.params.owner, req.params.name]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Repo not found' });

    const updated = await updateThresholds(rows[0].id, { bundle_kb, query_count, api_p95_ms });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** GET /api/repos/:owner/:name/ai-review — AI project health review */
router.get('/repos/:owner/:name/ai-review', requireAuth, async (req, res) => {
  try {
    const { pool } = require('../db');
    const { rows } = await pool.query(
      `SELECT id, name FROM repos WHERE owner = $1 AND name = $2 LIMIT 1`,
      [req.params.owner, req.params.name]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Repo not found' });

    const repoId = rows[0].id;
    const repoName = rows[0].name;

    const [totalRes, passRes, failRes, avgRes, worstRes, causeRes, recentCauseRes] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS count FROM checks WHERE repo_id = $1`, [repoId]),
      pool.query(`SELECT COUNT(*)::int AS count FROM checks WHERE repo_id = $1 AND status = 'pass'`, [repoId]),
      pool.query(`SELECT COUNT(*)::int AS count FROM checks WHERE repo_id = $1 AND status = 'fail'`, [repoId]),
      pool.query(`SELECT COALESCE(AVG((results->'bundle_kb'->>'after')::numeric), 0) AS avg FROM checks WHERE repo_id = $1 AND results ? 'bundle_kb'`, [repoId]),
      pool.query(`SELECT COALESCE(MAX(ABS(COALESCE((results->'bundle_kb'->>'after')::numeric, 0) - COALESCE((results->'bundle_kb'->>'before')::numeric, 0))), 0) AS max FROM checks WHERE repo_id = $1 AND results ? 'bundle_kb'`, [repoId]),
      pool.query(`
        SELECT rc.cause_type, COUNT(*) AS cnt
        FROM regression_causes rc
        JOIN checks c ON c.id = rc.check_id
        WHERE c.repo_id = $1
        GROUP BY rc.cause_type
        ORDER BY cnt DESC
        LIMIT 1
      `, [repoId]),
      pool.query(`
        SELECT rc.detail
        FROM checks c
        JOIN regression_causes rc ON rc.check_id = c.id
        WHERE c.repo_id = $1 AND rc.cause_type = 'new_dependency'
        ORDER BY c.created_at DESC
        LIMIT 5
      `, [repoId]),
    ]);

    const totalChecks = totalRes.rows[0].count;
    const passedChecks = passRes.rows[0].count;
    const failedChecks = failRes.rows[0].count;
    const avgBundleKB = parseFloat(avgRes.rows[0].avg) || 0;
    const worstRegressionKB = parseFloat(worstRes.rows[0].max) || 0;
    const mostCommonCause = causeRes.rows[0]?.cause_type || 'unknown';

    const recentPackagesAdded = [];
    for (const row of recentCauseRes.rows) {
      const detail = row.detail || '';
      const match = detail.match(/Added packages: (.+)/);
      if (match) {
        for (const pkg of match[1].split(', ')) {
          const cleaned = pkg.trim();
          if (cleaned && !recentPackagesAdded.includes(cleaned)) {
            recentPackagesAdded.push(cleaned);
          }
        }
      }
    }

    const axios = require('axios');
    const NLP_URL = process.env.NLP_SERVICE_URL || 'http://localhost:8000';
    const { data } = await axios.post(
      `${NLP_URL}/review`,
      {
        repo_name: repoName,
        total_checks: totalChecks,
        passed_checks: passedChecks,
        failed_checks: failedChecks,
        avg_bundle_kb: avgBundleKB,
        worst_regression_kb: worstRegressionKB,
        most_common_cause: mostCommonCause,
        recent_packages_added: recentPackagesAdded,
      },
      { timeout: 20_000 }
    );

    res.json({ report: data.report });
  } catch (err) {
    console.error('[ai-review] Error:', err.message);
    res.json({ report: 'AI review temporarily unavailable.' });
  }
});

module.exports = router;
