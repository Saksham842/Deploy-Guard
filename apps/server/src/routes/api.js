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

    // Redirect dashboard with token in query string (SPA picks it up and stores in localStorage)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/callback?token=${access_token}&username=${ghUser.login}&avatar=${encodeURIComponent(ghUser.avatar_url)}`);
  } catch (err) {
    console.error('[oauth] Callback error:', err.message);
    res.status(500).json({ error: 'OAuth callback failed' });
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

module.exports = router;
