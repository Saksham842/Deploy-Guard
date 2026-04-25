/**
 * DeployGuard — Bull Queue Worker
 *
 * Processes PR check jobs asynchronously so the webhook handler returns 200
 * immediately and GitHub doesn't time out waiting for a response.
 *
 * Usage: This module is imported by index.js at server startup.
 *        Workers run in the same process (fine for a demo/free-tier deploy).
 *        For higher scale, extract to a separate worker.js process.
 */

const Queue  = require('bull');
const { analyseBundle }   = require('../analysers/bundle');
const { diffPackageJson } = require('../analysers/packageDiff');
const { classifyCommits } = require('../nlp/client');
const { buildComment, buildSummary } = require('../comment');
const {
  getOrCreateRepo,
  getBaseline,
  upsertBaseline,
  saveCheck,
  getThresholds,
} = require('../db');

// ─── Queue definition ─────────────────────────────────────────────────────────
const checkQueue = new Queue('pr-checks', {
  redis: process.env.REDIS_URL || 'redis://localhost:6379',
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
});

// ─── Enqueue a job (called from webhook.js) ──────────────────────────────────
async function enqueueCheck(jobData) {
  const job = await checkQueue.add('analyse', jobData, { priority: 1 });
  console.log(`[queue] Enqueued check job ${job.id} for PR #${jobData.prNumber}`);
  return job;
}

// ─── Worker ──────────────────────────────────────────────────────────────────
checkQueue.process('analyse', 2 /* concurrency */, async (job) => {
  const {
    installId, repoGithubId, owner, repoName,
    headSha, baseSha, prNumber, baseBranch,
    checkRunId,
  } = job.data;

  console.log(`[worker] Processing PR #${prNumber} on ${owner}/${repoName}`);

  // Re-create an authenticated Octokit for this installation
  // (We can't serialise the octokit instance into the queue)
  const { app } = require('../webhook');
  const octokit = await app.getInstallationOctokit(installId);

  try {
    const repo       = await getOrCreateRepo(repoGithubId, owner, repoName, installId);
    const thresholds = await getThresholds(repo.id);

    const [bundleBaseline] = await Promise.all([
      getBaseline(repo.id, baseBranch, 'bundle_kb'),
    ]);

    const [bundleResult, pkgDiff] = await Promise.all([
      analyseBundle(octokit, { owner: { login: owner }, name: repoName }, headSha),
      diffPackageJson(octokit, { owner: { login: owner }, name: repoName }, baseSha, headSha),
    ]);

    const { data: commitsData } = await octokit.rest.pulls.listCommits({
      owner, repo: repoName, pull_number: prNumber, per_page: 50,
    });
    const messages = commitsData.map(c => c.commit.message);
    const causes   = await classifyCommits(messages, pkgDiff);

    const bundleBefore = bundleBaseline?.value ?? null;
    const bundleAfter  = bundleResult.totalKb;
    const bundleDelta  = bundleBefore
      ? ((bundleAfter - bundleBefore) / bundleBefore) * 100
      : 0;

    const metrics = [{
      key: 'bundle_kb', label: 'Bundle Size',
      before: bundleBefore, after: bundleAfter, delta: bundleDelta,
      unit: 'KB', threshold: thresholds.bundle_kb,
      passed: Math.abs(bundleDelta) <= thresholds.bundle_kb || bundleBefore === null,
    }];

    const passed = metrics.every(m => m.passed);

    await saveCheck({
      repoId: repo.id, prNumber, headSha, baseSha,
      status: passed ? 'pass' : 'fail',
      results: { bundle_kb: { before: bundleBefore, after: bundleAfter, delta: bundleDelta } },
      causes,
    });

    if (['main', 'master'].includes(baseBranch) && passed) {
      await upsertBaseline(repo.id, baseBranch, 'bundle_kb', bundleAfter, headSha);
    }

    const summary = buildSummary(metrics, causes);
    await octokit.rest.checks.update({
      owner, repo: repoName, check_run_id: checkRunId,
      status: 'completed',
      conclusion: passed ? 'success' : 'failure',
      completed_at: new Date().toISOString(),
      output: {
        title: passed ? '✅ No performance regressions' : `⚠️ Regression: ${metrics.filter(m => !m.passed).map(m => m.label).join(', ')}`,
        summary,
      },
    });

    await octokit.rest.issues.createComment({
      owner, repo: repoName, issue_number: prNumber,
      body: buildComment(metrics, causes, pkgDiff),
    });

    console.log(`[worker] ✅ PR #${prNumber} → ${passed ? 'pass' : 'fail'} (bundle: ${bundleAfter} KB, Δ${bundleDelta.toFixed(1)}%)`);
  } catch (err) {
    console.error(`[worker] ❌ Job failed for PR #${prNumber}:`, err.message);

    try {
      const { app } = require('../webhook');
      const octokit = await app.getInstallationOctokit(installId);
      await octokit.rest.checks.update({
        owner, repo: repoName, check_run_id: checkRunId,
        status: 'completed', conclusion: 'neutral',
        completed_at: new Date().toISOString(),
        output: { title: '⚠️ DeployGuard error', summary: err.message },
      });
    } catch (updateErr) {
      console.error('[worker] Could not update check run after failure:', updateErr.message);
    }

    throw err; // Re-throw so Bull marks the job as failed and retries
  }
});

// ─── Queue event logging ──────────────────────────────────────────────────────
checkQueue.on('failed',    (job, err)  => console.error(`[queue] Job ${job.id} failed:`, err.message));
checkQueue.on('completed', (job)       => console.log(`[queue] Job ${job.id} completed`));
checkQueue.on('stalled',   (job)       => console.warn(`[queue] Job ${job.id} stalled`));

module.exports = { checkQueue, enqueueCheck };
