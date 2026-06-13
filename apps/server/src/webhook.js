/**
 * webhook.js — GitHub App event hub
 *
 * Receives signed webhook payloads from GitHub and orchestrates the full
 * DeployGuard analysis pipeline:
 *
 *   pull_request.*         → creates a pending Check Run on the head commit
 *   workflow_run.completed → downloads the CI artifact, runs analysis, posts results
 *   installation.*         → registers newly connected repositories in the database
 */

const { App, createNodeMiddleware } = require('@octokit/app');
const { Octokit }                   = require('@octokit/rest');
const { analyseBundle }             = require('./analysers/bundle');
const { diffPackageJson }           = require('./analysers/packageDiff');
const { classifyCommits }           = require('./nlp/client');
const { buildComment, buildSummary } = require('./comment');
const { getAIExplanation, getAISummary } = require('./utils/groqExplain');
const {
  getOrCreateRepo,
  getBaseline,
  upsertBaseline,
  saveCheck,
  getThresholds,
} = require('./db');

// ---------------------------------------------------------------------------
// GitHub App — private key is stored base64-encoded in the environment to
// avoid newline handling issues across different deployment platforms.
// ---------------------------------------------------------------------------
const app = new App({
  appId:    process.env.GITHUB_APP_ID,
  privateKey: Buffer.from(process.env.GITHUB_PRIVATE_KEY || '', 'base64').toString('utf8'),
  webhooks: { secret: process.env.GITHUB_WEBHOOK_SECRET },
  oauth: {
    clientId:     process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  },
  Octokit,
});

// ---------------------------------------------------------------------------
// Event subscriptions
// ---------------------------------------------------------------------------
app.webhooks.on('pull_request.opened',      handlePR);
app.webhooks.on('pull_request.synchronize', handlePR);
app.webhooks.on('pull_request.reopened',    handlePR);
app.webhooks.on('installation.created',                handleInstallation);
app.webhooks.on('installation_repositories.added',     handleInstallation);
app.webhooks.on('workflow_run.completed',              handleWorkflowRun);

app.webhooks.onError((error) => {
  console.error('[webhook] Unhandled error:', error.message);
});

// ---------------------------------------------------------------------------
// handlePR — fired on PR open / push / reopen
//
// Creates an in_progress Check Run immediately so GitHub shows the pending
// indicator. The run is completed later by handleWorkflowRun once the
// Bundle Analysis CI job finishes and its artifact is available.
// ---------------------------------------------------------------------------
async function handlePR({ octokit, payload }) {
  const { repository, pull_request, installation } = payload;

  const owner    = repository.owner.login;
  const repoName = repository.name;
  const headSha  = pull_request.head.sha;
  const prNumber = pull_request.number;

  console.log(`[webhook] PR #${prNumber} opened on ${owner}/${repoName} (${headSha.slice(0, 7)})`);

  await getOrCreateRepo(repository.id, owner, repoName, installation.id);

  const { data: checkRun } = await octokit.rest.checks.create({
    owner,
    repo:       repoName,
    name:       'DeployGuard',
    head_sha:   headSha,
    status:     'in_progress',
    started_at: new Date().toISOString(),
    output: {
      title:   '⏳ Waiting for Bundle Analysis CI…',
      summary: 'DeployGuard will post results automatically once the bundle stats artifact is uploaded.',
    },
  });

  console.log(`[webhook] Check run #${checkRun.id} created`);
}

// ---------------------------------------------------------------------------
// handleWorkflowRun — fired when any Actions workflow on this repo completes
//
// Filtered to only the two workflow names DeployGuard cares about:
//   - "Bundle Analysis"        (DeployGuard's own repo)
//   - "DeployGuard Bundle Stats" (tenant onboarding template)
//
// Fork PR handling: GitHub omits pull_requests[] for cross-fork runs as a
// security measure. When the list is empty we fall back to the REST API and
// match open PRs by head SHA.
// ---------------------------------------------------------------------------
async function handleWorkflowRun({ octokit, payload }) {
  const { workflow_run, repository, installation } = payload;

  const allowedWorkflows = ['Bundle Analysis', 'DeployGuard Bundle Stats'];
  if (!allowedWorkflows.includes(workflow_run.name)) return;

  if (workflow_run.conclusion !== 'success') {
    console.warn(`[workflow_run] "${workflow_run.name}" ended with ${workflow_run.conclusion} — skipping`);
    return;
  }

  const owner    = repository.owner.login;
  const repoName = repository.name;
  const headSha  = workflow_run.head_sha;

  console.log(`[workflow_run] Bundle Analysis completed for ${owner}/${repoName} (${headSha.slice(0, 7)})`);

  // installation may be absent on some workflow_run payloads
  const installId = installation?.id ?? workflow_run.installation?.id ?? null;
  const repo       = await getOrCreateRepo(repository.id, owner, repoName, installId);
  const thresholds = await getThresholds(repo.id);

  let prs = workflow_run.pull_requests || [];

  // Fork PR fallback — query open PRs by head SHA when the payload list is empty
  if (prs.length === 0) {
    try {
      const { data: openPRs } = await octokit.rest.pulls.list({
        owner, repo: repoName, state: 'open', per_page: 10,
      });

      const matching = openPRs.filter(pr => pr.head.sha === headSha);

      if (matching.length === 0) {
        // No open PR — could be a direct push to main/master; update the baseline
        if (['main', 'master'].includes(workflow_run.head_branch)) {
          console.log(`[workflow_run] Direct push to ${workflow_run.head_branch} — updating baseline`);
          const bundleResult = await analyseBundle(octokit, { owner: { login: owner }, name: repoName }, headSha);
          if (bundleResult.totalKb !== null) {
            await upsertBaseline(repo.id, workflow_run.head_branch, 'bundle_kb', bundleResult.totalKb, headSha);
            console.log(`[workflow_run] Baseline → ${bundleResult.totalKb} KB on ${workflow_run.head_branch}`);
          }
        } else {
          console.log('[workflow_run] No matching open PRs — skipping');
        }
        return;
      }

      prs = matching.map(pr => ({
        number: pr.number,
        base:   { sha: pr.base.sha, ref: pr.base.ref },
      }));
      console.log(`[workflow_run] Fork-PR fallback: matched ${prs.length} PR(s)`);
    } catch (err) {
      console.warn('[workflow_run] Fork-PR fallback failed:', err.message);
      return;
    }
  }

  for (const pr of prs) {
    const { number: prNumber, base: { sha: baseSha, ref: baseBranch } } = pr;

    console.log(`[workflow_run] Analysing PR #${prNumber}`);

    // Locate the pending DeployGuard check to update, or create a new one
    let checkRunId = null;
    try {
      const { data } = await octokit.rest.checks.listForRef({
        owner, repo: repoName, ref: headSha, check_name: 'DeployGuard', per_page: 5,
      });
      checkRunId = data.check_runs.find(c => c.status !== 'completed')?.id ?? null;
    } catch { /* will create a fresh check below */ }

    if (!checkRunId) {
      try {
        const { data: newCheck } = await octokit.rest.checks.create({
          owner, repo: repoName, name: 'DeployGuard', head_sha: headSha,
          status: 'in_progress', started_at: new Date().toISOString(),
          output: { title: '🔍 Analysing bundle…', summary: 'Reading CI artifact…' },
        });
        checkRunId = newCheck.id;
      } catch (e) {
        console.error('[workflow_run] Failed to create check run:', e.message);
        return;
      }
    }

    await runAnalysis({ octokit, owner, repoName, headSha, baseSha, baseBranch, prNumber, repo, thresholds, checkRunId });
  }
}

// ---------------------------------------------------------------------------
// runAnalysis — the core pipeline, shared by both event handlers
//
// 1. Fetch baselines from DB (with main/master fallback for new branches)
// 2. Download and parse the bundle-stats CI artifact
// 3. Diff package.json between base and head
// 4. Classify commit messages via the NLP pipeline
// 5. Compute metrics and pass/fail status
// 6. Persist check result to DB
// 7. Get an AI-generated explanation (via NLP service → Groq direct fallback)
// 8. Update the GitHub Check Run and post a PR comment
// ---------------------------------------------------------------------------
async function runAnalysis({ octokit, owner, repoName, headSha, baseSha, baseBranch, prNumber, repo, thresholds, checkRunId }) {
  try {
    let [bundleBaseline, queryBaseline, apiBaseline] = await Promise.all([
      getBaseline(repo.id, baseBranch, 'bundle_kb'),
      getBaseline(repo.id, baseBranch, 'query_count'),
      getBaseline(repo.id, baseBranch, 'api_p95_ms'),
    ]);

    // If the target branch has no recorded baseline, fall back to main/master.
    // This prevents n/a results on feature branches that diverged from main.
    if (!bundleBaseline && !['main', 'master'].includes(baseBranch)) {
      const mainBaseline  = await getBaseline(repo.id, 'main', 'bundle_kb');
      const fallbackBranch = mainBaseline ? 'main' : 'master';
      const [fBundle, fQuery, fApi] = await Promise.all([
        getBaseline(repo.id, fallbackBranch, 'bundle_kb'),
        getBaseline(repo.id, fallbackBranch, 'query_count'),
        getBaseline(repo.id, fallbackBranch, 'api_p95_ms'),
      ]);
      if (fBundle) {
        console.log(`[analysis] No baseline for "${baseBranch}" — using "${fallbackBranch}" fallback`);
        bundleBaseline = fBundle;
        queryBaseline  = fQuery;
        apiBaseline    = fApi;
      }
    }

    const bundleResult = await analyseBundle(octokit, { owner: { login: owner }, name: repoName }, headSha);
    const pkgDiff      = await diffPackageJson(octokit, { owner: { login: owner }, name: repoName }, baseSha, headSha);

    const { data: commitsData } = await octokit.rest.pulls.listCommits({
      owner, repo: repoName, pull_number: prNumber, per_page: 50,
    });
    const messages = commitsData.map(c => c.commit.message);

    const causes  = await classifyCommits(messages, pkgDiff);
    const metrics = computeMetrics({ bundleResult, bundleBaseline, queryBaseline, apiBaseline, thresholds });
    const passed  = metrics.length > 0 ? metrics.every(m => m.passed) : true;

    await saveCheck({
      repoId: repo.id, prNumber, headSha, baseSha,
      status:  passed ? 'pass' : 'fail',
      results: buildResultsJson(metrics),
      causes,
    });

    // AI explanation — passes through NLP service with direct Groq fallback
    const bundleMetric   = metrics.find(m => m.key === 'bundle_kb');
    const bundleDeltaKB  = bundleMetric?.before !== null ? Math.round((bundleMetric.after - bundleMetric.before) * 100) / 100 : 0;
    const bundleDeltaPct = bundleMetric ? Math.round(bundleMetric.delta * 100) / 100 : 0;

    const aiExplanation = passed
      ? await getAISummary({ bundleDeltaKB, bundleDeltaPct, addedPackages: pkgDiff.added || [], removedPackages: pkgDiff.removed || [], commitMessages: messages })
      : await getAIExplanation({ bundleDeltaKB, bundleDeltaPct, addedPackages: pkgDiff.added || [], removedPackages: pkgDiff.removed || [], commitMessages: messages, nlpCauseLabel: causes[0]?.cause_type ?? 'unknown' });

    // Keep the baseline fresh when a passing change lands on the default branch
    if (['main', 'master'].includes(baseBranch) && passed && bundleResult.totalKb !== null) {
      await upsertBaseline(repo.id, baseBranch, 'bundle_kb', bundleResult.totalKb, headSha);
    }

    await octokit.rest.checks.update({
      owner, repo: repoName, check_run_id: checkRunId,
      status:       'completed',
      conclusion:   passed ? 'success' : 'failure',
      completed_at: new Date().toISOString(),
      output: {
        title:   passed
          ? '✅ No performance regressions detected'
          : `⚠️ Regression — ${metrics.filter(m => !m.passed).map(m => m.label).join(', ')}`,
        summary: buildSummary(metrics, causes),
      },
    });

    await octokit.rest.issues.createComment({
      owner, repo: repoName, issue_number: prNumber,
      body: buildComment(metrics, causes, pkgDiff, aiExplanation),
    });

  } catch (err) {
    console.error('[analysis] Pipeline error:', err.message);
    try {
      await octokit.rest.checks.update({
        owner, repo: repoName, check_run_id: checkRunId,
        status: 'completed', conclusion: 'neutral',
        completed_at: new Date().toISOString(),
        output: {
          title:   '⚠️ DeployGuard encountered an error',
          summary: `\`\`\`\n${err.message}\n\`\`\``,
        },
      });
    } catch (updateErr) {
      console.error('[analysis] Failed to update check run after error:', updateErr.message);
    }
  }
}

// ---------------------------------------------------------------------------
// handleInstallation — registers repos when the GitHub App is installed
// ---------------------------------------------------------------------------
async function handleInstallation({ payload }) {
  const { installation, repositories, repositories_added } = payload;
  const repos = repositories || repositories_added || [];

  console.log(`[webhook] Installation: syncing ${repos.length} repo(s) for ${installation.account.login}`);

  for (const repo of repos) {
    try {
      await getOrCreateRepo(repo.id, installation.account.login, repo.name, installation.id);
    } catch (err) {
      console.error(`[webhook] Failed to sync repo "${repo.name}":`, err.message);
    }
  }
}

// ---------------------------------------------------------------------------
// Metric computation helpers
// ---------------------------------------------------------------------------

/**
 * Computes pass/fail metrics from live bundle data and stored baselines.
 * Only emits a metric when meaningful data exists — never invents values.
 */
function computeMetrics({ bundleResult, bundleBaseline, queryBaseline, apiBaseline, thresholds }) {
  const metrics = [];

  if (bundleResult.totalKb !== null) {
    const before = bundleBaseline?.value ?? null;
    const after  = bundleResult.totalKb;
    const delta  = before ? ((after - before) / before) * 100 : 0;

    metrics.push({
      key:       'bundle_kb',
      label:     'Bundle Size',
      before,
      after,
      delta,
      unit:      'KB',
      threshold: thresholds.bundle_kb,
      passed:    Math.abs(delta) <= thresholds.bundle_kb || before === null,
    });
  } else {
    console.log('[analysis] No CI artifact — bundle metric skipped');
  }

  // Query count and API latency are populated by an external test harness in
  // production. We report the baseline and mark as passed until real values arrive.
  if (queryBaseline) {
    metrics.push({ key: 'query_count', label: 'Query Count', before: queryBaseline.value, after: null, delta: 0, unit: 'queries', threshold: thresholds.query_count, passed: true });
  }

  if (apiBaseline) {
    metrics.push({ key: 'api_p95_ms', label: 'API p95 Latency', before: apiBaseline.value, after: null, delta: 0, unit: 'ms', threshold: thresholds.api_p95_ms, passed: true });
  }

  return metrics;
}

function buildResultsJson(metrics) {
  return Object.fromEntries(metrics.map(m => [m.key, { before: m.before, after: m.after, delta: m.delta }]));
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  app,
  middleware: createNodeMiddleware(app, { path: '/api/github/webhooks' }),
};
