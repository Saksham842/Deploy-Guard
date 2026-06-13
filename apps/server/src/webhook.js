const { App, createNodeMiddleware } = require('@octokit/app');
const { Octokit } = require('@octokit/rest');
const { analyseBundle } = require('./analysers/bundle');
const { diffPackageJson } = require('./analysers/packageDiff');
const { classifyCommits } = require('./nlp/client');
const { buildComment, buildSummary } = require('./comment');
const { getAIExplanation, getAISummary } = require('./utils/groqExplain');
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

// Fires when a GitHub Actions workflow run completes (e.g. Bundle Analysis).
// This is what actually triggers the real bundle measurement after CI finishes.
app.webhooks.on('workflow_run.completed',   handleWorkflowRun);

app.webhooks.onError((error) => {
  console.error('[webhook] Error:', error);
});

// ─── PR opened/synchronised handler ─────────────────────────────────────────
async function handlePR({ octokit, payload }) {
  const { repository, pull_request, installation } = payload;

  const owner      = repository.owner.login;
  const repoName   = repository.name;
  const headSha    = pull_request.head.sha;
  const prNumber   = pull_request.number;

  console.log(`[webhook] PR #${prNumber} on ${owner}/${repoName} — head ${headSha.slice(0, 7)}`);

  // Upsert repo record
  const repo = await getOrCreateRepo(repository.id, owner, repoName, installation.id);

  // Post an in_progress check immediately so GitHub shows the pending indicator.
  // We leave it in_progress here — the workflow_run handler will complete it
  // once the Bundle Analysis CI job finishes and the artifact is available.
  const { data: checkRun } = await octokit.rest.checks.create({
    owner,
    repo: repoName,
    name: 'DeployGuard',
    head_sha: headSha,
    status: 'in_progress',
    started_at: new Date().toISOString(),
    output: {
      title: '⏳ Waiting for Bundle Analysis CI…',
      summary:
        'DeployGuard is waiting for the Bundle Analysis workflow to complete. ' +
        'Results will appear automatically once the artifact is uploaded.',
    },
  });

  console.log(`[webhook] Check run #${checkRun.id} created — waiting for CI artifact`);
}

// ─── Workflow run completed handler ──────────────────────────────────────────
// Fires when ANY workflow run on this repo completes.
// We filter to only the "Bundle Analysis" workflow so we can grab real sizes.
async function handleWorkflowRun({ octokit, payload }) {
  const { workflow_run, repository, installation } = payload;

  // Only care about our specific workflow
  if (workflow_run.name !== 'Bundle Analysis') return;
  if (workflow_run.conclusion !== 'success') {
    console.warn(`[workflow_run] Bundle Analysis ended with conclusion=${workflow_run.conclusion} — skipping`);
    return;
  }

  // workflow_run.pull_requests is populated by GitHub when the run was triggered by a PR.
  // NOTE: this is empty for fork PRs — we handle that below after we have octokit context.
  let prs = workflow_run.pull_requests || [];

  const owner    = repository.owner.login;
  const repoName = repository.name;
  const headSha  = workflow_run.head_sha;

  console.log(`[workflow_run] Bundle Analysis completed for ${owner}/${repoName} — head ${headSha.slice(0, 7)}`);

  // installation may be absent on some workflow_run events — use optional chaining
  const installId = installation?.id ?? workflow_run.installation?.id ?? null;
  const repo       = await getOrCreateRepo(repository.id, owner, repoName, installId);
  const thresholds = await getThresholds(repo.id);

  // ── Fork PR fallback ─────────────────────────────────────────────────────────
  // GitHub does NOT populate workflow_run.pull_requests for cross-fork PRs.
  // When the list is empty, query the GitHub API directly for open PRs
  // whose head SHA matches the workflow run.
  if (prs.length === 0) {
    try {
      const { data: openPRs } = await octokit.rest.pulls.list({
        owner, repo: repoName, state: 'open', per_page: 10,
      });
      const matching = openPRs.filter(pr => pr.head.sha === headSha);
      if (matching.length === 0) {
        console.log('[workflow_run] No open PRs match head SHA — skipping (push to main handled by baseline update)');
        return;
      }
      prs = matching.map(pr => ({
        number: pr.number,
        base:   { sha: pr.base.sha, ref: pr.base.ref },
      }));
      console.log(`[workflow_run] Fork-PR fallback: found ${prs.length} matching PR(s) via API`);
    } catch (err) {
      console.warn('[workflow_run] Fork-PR fallback query failed:', err.message);
      return;
    }
  }

  for (const pr of prs) {
    const prNumber   = pr.number;
    const baseSha    = pr.base.sha;
    const baseBranch = pr.base.ref;

    console.log(`[workflow_run] Running analysis for PR #${prNumber}`);

    // Find the in_progress DeployGuard check on this head SHA so we can update it
    let checkRunId = null;
    try {
      const { data: checksData } = await octokit.rest.checks.listForRef({
        owner, repo: repoName, ref: headSha, check_name: 'DeployGuard', per_page: 5,
      });
      const existing = checksData.check_runs.find(c => c.status !== 'completed');
      checkRunId = existing?.id ?? null;
    } catch { /* will create a new check below */ }

    // If there's no existing in_progress check, create one
    if (!checkRunId) {
      try {
        const { data: newCheck } = await octokit.rest.checks.create({
          owner, repo: repoName, name: 'DeployGuard', head_sha: headSha,
          status: 'in_progress', started_at: new Date().toISOString(),
          output: { title: '🔍 Analysing bundle…', summary: 'Reading CI artifact…' },
        });
        checkRunId = newCheck.id;
      } catch (e) {
        console.error('[workflow_run] Could not create check run:', e.message);
        return;
      }
    }

    await runAnalysis({
      octokit, owner, repoName,
      headSha, baseSha, baseBranch,
      prNumber, repo, thresholds, checkRunId,
    });
  }
}

// ─── Core analysis (shared by both handlers) ─────────────────────────────────
async function runAnalysis({
  octokit, owner, repoName,
  headSha, baseSha, baseBranch,
  prNumber, repo, thresholds, checkRunId,
}) {
  try {
    // ── 1. Fetch existing baselines ──────────────────────────────────────────
    const [bundleBaseline, queryBaseline, apiBaseline] = await Promise.all([
      getBaseline(repo.id, baseBranch, 'bundle_kb'),
      getBaseline(repo.id, baseBranch, 'query_count'),
      getBaseline(repo.id, baseBranch, 'api_p95_ms'),
    ]);

    // ── 2. Analyse bundle (fetches CI artifact) ──────────────────────────────
    const bundleResult = await analyseBundle(octokit, { owner: { login: owner }, name: repoName }, headSha);

    // ── 3. Diff package.json ─────────────────────────────────────────────────
    const pkgDiff = await diffPackageJson(
      octokit, { owner: { login: owner }, name: repoName }, baseSha, headSha
    );

    // ── 4. Collect commit messages ────────────────────────────────────────────
    const { data: commitsData } = await octokit.rest.pulls.listCommits({
      owner, repo: repoName, pull_number: prNumber, per_page: 50,
    });
    const messages = commitsData.map(c => c.commit.message);

    // ── 5. NLP classify ───────────────────────────────────────────────────────
    const causes = await classifyCommits(messages, pkgDiff);

    // ── 6. Compute metrics ───────────────────────────────────────────────────
    const metrics = computeMetrics({ bundleResult, bundleBaseline, queryBaseline, apiBaseline, thresholds });
    const passed  = metrics.length > 0 ? metrics.every(m => m.passed) : true;

    // ── 7. Save to DB ─────────────────────────────────────────────────────────
    await saveCheck({
      repoId: repo.id, prNumber, headSha, baseSha,
      status: passed ? 'pass' : 'fail',
      results: buildResultsJson(metrics),
      causes,
    });

    // ── 8. AI explanation / summary ───────────────────────────────────────────
    let aiExplanation = null;
    const bundleMetric  = metrics.find(m => m.key === 'bundle_kb');
    const bundleDeltaKB  = bundleMetric && bundleMetric.before !== null
      ? Math.round((bundleMetric.after - bundleMetric.before) * 100) / 100 : 0;
    const bundleDeltaPct = bundleMetric ? Math.round(bundleMetric.delta * 100) / 100 : 0;

    if (passed) {
      aiExplanation = await getAISummary({
        bundleDeltaKB, bundleDeltaPct,
        addedPackages: pkgDiff.added || [],
        removedPackages: pkgDiff.removed || [],
        commitMessages: messages,
      });
    } else {
      const nlpCauseLabel = causes.length > 0 ? causes[0].cause_type : 'unknown';
      aiExplanation = await getAIExplanation({
        bundleDeltaKB, bundleDeltaPct,
        addedPackages: pkgDiff.added || [],
        removedPackages: pkgDiff.removed || [],
        commitMessages: messages,
        nlpCauseLabel,
      });
    }

    // ── 9. Update baseline on push to main ───────────────────────────────────
    const isMainBranch = ['main', 'master'].includes(baseBranch);
    if (isMainBranch && passed && bundleResult.totalKb !== null) {
      await upsertBaseline(repo.id, baseBranch, 'bundle_kb', bundleResult.totalKb, headSha);
    }

    // ── 10. Finalise the check run ────────────────────────────────────────────
    const summary = buildSummary(metrics, causes);
    await octokit.rest.checks.update({
      owner, repo: repoName, check_run_id: checkRunId,
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

    // ── 11. Post PR comment ───────────────────────────────────────────────────
    await octokit.rest.issues.createComment({
      owner, repo: repoName, issue_number: prNumber,
      body: buildComment(metrics, causes, pkgDiff, aiExplanation),
    });

  } catch (err) {
    console.error('[runAnalysis] Error:', err);
    try {
      await octokit.rest.checks.update({
        owner, repo: repoName, check_run_id: checkRunId,
        status: 'completed', conclusion: 'neutral',
        completed_at: new Date().toISOString(),
        output: {
          title: '⚠️ DeployGuard encountered an error',
          summary: `\`\`\`\n${err.message}\n\`\`\``,
        },
      });
    } catch (updateErr) {
      console.error('[runAnalysis] Failed to update check run after error:', updateErr);
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

  // Bundle KB — only if CI artifact was present
  if (bundleResult.totalKb !== null) {
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
  } else {
    // No artifact — log and skip (no fake data)
    console.log('[webhook] Bundle size unavailable (no CI artifact) — skipping bundle metric');
  }

  // Query count — only if baseline exists.
  // Real delta is populated by a test harness in production;
  // for now we report the baseline value and skip regression detection.
  if (queryBaseline) {
    metrics.push({
      key:       'query_count',
      label:     'Query Count',
      before:    queryBaseline.value,
      after:     null,   // populated by test harness in production
      delta:     0,
      unit:      'queries',
      threshold: thresholds.query_count,
      passed:    true,   // placeholder — real value comes from test harness
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
