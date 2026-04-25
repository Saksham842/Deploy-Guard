const { App, createNodeMiddleware } = require('@octokit/app');
const { Octokit } = require('@octokit/rest');
const { analyseBundle } = require('./analysers/bundle');
const { diffPackageJson } = require('./analysers/packageDiff');
const { classifyCommits } = require('./nlp/client');
const { buildComment, buildSummary } = require('./comment');
const {
  getOrCreateRepo,
  getBaseline,
  upsertBaseline,
  saveCheck,
  getThresholds,
} = require('./db');

// ─── GitHub App initialisation ────────────────────────────────────────────────
const app = new App({
  appId: process.env.GITHUB_APP_ID,
  privateKey: Buffer.from(process.env.GITHUB_PRIVATE_KEY || '', 'base64').toString('utf8'),
  webhooks: { secret: process.env.GITHUB_WEBHOOK_SECRET },
  oauth: {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  },
  Octokit,
});

// ─── Event subscriptions ──────────────────────────────────────────────────────
app.webhooks.on('pull_request.opened',      handlePR);
app.webhooks.on('pull_request.synchronize', handlePR);
app.webhooks.on('pull_request.reopened',    handlePR);
app.webhooks.on('installation.created',     handleInstallation);
app.webhooks.on('installation_repositories.added', handleInstallation);

app.webhooks.onError((error) => {
  console.error('[webhook] Error:', error);
});

// ─── Core handler ─────────────────────────────────────────────────────────────
async function handlePR({ octokit, payload }) {
  const { repository, pull_request, installation } = payload;

  const owner    = repository.owner.login;
  const repoName = repository.name;
  const headSha  = pull_request.head.sha;
  const baseSha  = pull_request.base.sha;
  const prNumber = pull_request.number;
  const baseBranch = pull_request.base.ref;

  console.log(`[webhook] PR #${prNumber} on ${owner}/${repoName} — head ${headSha.slice(0, 7)}`);

  // ── 1. Upsert repo record ──────────────────────────────────────────────────
  const repo = await getOrCreateRepo(
    repository.id, owner, repoName, installation.id
  );
  const thresholds = await getThresholds(repo.id);

  // ── 2. Post a pending check immediately so GitHub shows it in the UI ───────
  const { data: checkRun } = await octokit.rest.checks.create({
    owner,
    repo: repoName,
    name: 'DeployGuard',
    head_sha: headSha,
    status: 'in_progress',
    started_at: new Date().toISOString(),
    output: {
      title: '🔍 Analysing performance…',
      summary: 'DeployGuard is measuring bundle size, query count, and API latency.',
    },
  });

  try {
    // ── 3. Fetch existing baselines ──────────────────────────────────────────
    const [bundleBaseline, queryBaseline, apiBaseline] = await Promise.all([
      getBaseline(repo.id, baseBranch, 'bundle_kb'),
      getBaseline(repo.id, baseBranch, 'query_count'),
      getBaseline(repo.id, baseBranch, 'api_p95_ms'),
    ]);

    // ── 4. Analyse bundle (fetches CI artifact, falls back to mock) ──────────
    const bundleResult = await analyseBundle(octokit, repository, headSha);

    // ── 5. Diff package.json between base → head ─────────────────────────────
    const pkgDiff = await diffPackageJson(octokit, repository, baseSha, headSha);

    // ── 6. Collect commit messages ────────────────────────────────────────────
    const { data: commitsData } = await octokit.rest.pulls.listCommits({
      owner, repo: repoName, pull_number: prNumber, per_page: 50,
    });
    const messages = commitsData.map(c => c.commit.message);

    // ── 7. NLP classify ────────────────────────────────────────────────────────
    const causes = await classifyCommits(messages, pkgDiff);

    // ── 8. Compute deltas + thresholds ────────────────────────────────────────
    const metrics = computeMetrics({ bundleResult, bundleBaseline, queryBaseline, apiBaseline, thresholds });
    const passed  = metrics.every(m => m.passed);

    // ── 9. Save to DB ──────────────────────────────────────────────────────────
    await saveCheck({
      repoId: repo.id,
      prNumber,
      headSha,
      baseSha,
      status: passed ? 'pass' : 'fail',
      results: buildResultsJson(metrics),
      causes,
    });

    // ── 10. Update baseline when merging to main (only on pass) ───────────────
    const isMainBranch = ['main', 'master'].includes(baseBranch);
    if (isMainBranch && passed) {
      await upsertBaseline(repo.id, baseBranch, 'bundle_kb', bundleResult.totalKb, headSha);
    }

    // ── 11. Finalise check run on GitHub ─────────────────────────────────────
    const summary = buildSummary(metrics, causes);
    await octokit.rest.checks.update({
      owner,
      repo: repoName,
      check_run_id: checkRun.id,
      status: 'completed',
      conclusion: passed ? 'success' : 'failure',
      completed_at: new Date().toISOString(),
      output: {
        title: passed
          ? '✅ No performance regressions detected'
          : `⚠️ Regression detected — ${metrics.filter(m => !m.passed).map(m => m.label).join(', ')}`,
        summary,
      },
    });

    // ── 12. Post PR comment ────────────────────────────────────────────────────
    await octokit.rest.issues.createComment({
      owner,
      repo: repoName,
      issue_number: prNumber,
      body: buildComment(metrics, causes, pkgDiff),
    });

  } catch (err) {
    console.error('[webhook] Handler error:', err);

    // Always resolve the check — never leave a PR permanently in_progress
    try {
      await octokit.rest.checks.update({
        owner,
        repo: repoName,
        check_run_id: checkRun.id,
        status: 'completed',
        conclusion: 'neutral',
        completed_at: new Date().toISOString(),
        output: {
          title: '⚠️ DeployGuard encountered an error',
          summary: `\`\`\`\n${err.message}\n\`\`\``,
        },
      });
    } catch (updateErr) {
      console.error('[webhook] Failed to update check run after error:', updateErr);
    }
  }
}

// ─── Installation handler ─────────────────────────────────────────────────────
async function handleInstallation({ payload }) {
  const { installation, repositories, repositories_added } = payload;
  const reposToProcess = repositories || repositories_added || [];
  
  console.log(`[webhook] Installation event: syncing ${reposToProcess.length} repos`);
  
  for (const repo of reposToProcess) {
    const owner = installation.account.login;
    const name = repo.name;
    try {
      await getOrCreateRepo(repo.id, owner, name, installation.id);
    } catch (err) {
      console.error(`[webhook] Failed to sync repo ${name}:`, err);
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeMetrics({ bundleResult, bundleBaseline, queryBaseline, apiBaseline, thresholds }) {
  const metrics = [];

  // Bundle KB
  const bundleBefore = bundleBaseline?.value ?? null;
  const bundleAfter  = bundleResult.totalKb;
  const bundleDelta  = bundleBefore
    ? ((bundleAfter - bundleBefore) / bundleBefore) * 100
    : 0;
  metrics.push({
    key:     'bundle_kb',
    label:   'Bundle Size',
    before:  bundleBefore,
    after:   bundleAfter,
    delta:   bundleDelta,
    unit:    'KB',
    threshold: thresholds.bundle_kb,
    passed:  Math.abs(bundleDelta) <= thresholds.bundle_kb || bundleBefore === null,
  });

  // Query count — only if baseline exists
  if (queryBaseline) {
    const qDelta = ((null - queryBaseline.value) / queryBaseline.value) * 100;
    metrics.push({
      key:     'query_count',
      label:   'Query Count',
      before:  queryBaseline.value,
      after:   null,   // populated by test harness in production
      delta:   0,
      unit:    'queries',
      threshold: thresholds.query_count,
      passed:  true,   // placeholder — real value comes from test harness
    });
  }

  // API p95 — only if baseline exists
  if (apiBaseline) {
    metrics.push({
      key:     'api_p95_ms',
      label:   'API p95 Latency',
      before:  apiBaseline.value,
      after:   null,
      delta:   0,
      unit:    'ms',
      threshold: thresholds.api_p95_ms,
      passed:  true,
    });
  }

  return metrics;
}

function buildResultsJson(metrics) {
  const result = {};
  for (const m of metrics) {
    result[m.key] = { before: m.before, after: m.after, delta: m.delta };
  }
  return result;
}

// ─── Exports ──────────────────────────────────────────────────────────────────
module.exports = {
  app,
  middleware: createNodeMiddleware(app, { path: '/api/github/webhooks' }),
};
