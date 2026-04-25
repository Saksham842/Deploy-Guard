require('dotenv').config();
const express = require('express');
const { middleware: webhookMiddleware } = require('./src/webhook');
const apiRouter = require('./src/routes/api');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Trust proxy (Railway / Render sit behind one) ──────────────────────────
app.set('trust proxy', 1);

// ── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'deployguard-server', ts: new Date().toISOString() });
});

// ── GitHub App webhooks  ─────────────────────────────────────────────────────
// Must come BEFORE express.json() — Octokit needs the raw body for HMAC verification
app.use('/api/github/webhooks', webhookMiddleware);

// ── JSON body parser ─────────────────────────────────────────────────────────
app.use(express.json());

// ── REST API (dashboard) ─────────────────────────────────────────────────────
app.use('/api', apiRouter);

// ── 404 fallback ─────────────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// ── Global error handler ─────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[server error]', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 DeployGuard server listening on port ${PORT}`);
  console.log(`   Webhook endpoint: POST /api/github/webhooks`);
  console.log(`   Health check:     GET  /health`);
});

module.exports = app;
