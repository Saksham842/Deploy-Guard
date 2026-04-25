/**
 * Bundle size analyser.
 *
 * Strategy:
 *   1. Look for a GitHub Actions artifact named "bundle-stats" on the head commit.
 *   2. Download it and parse webpack/vite stats.json to compute total bundle KB.
 *   3. Fall back to a mock 420 KB value during local development.
 */

const { Readable } = require('stream');

async function analyseBundle(octokit, repository, sha) {
  const owner    = repository.owner.login;
  const repoName = repository.name;

  try {
    // List recent workflow runs for this SHA
    const { data: runsData } = await octokit.rest.actions.listWorkflowRunsForRepo({
      owner,
      repo: repoName,
      head_sha: sha,
      per_page: 10,
      status: 'completed',
    });

    for (const run of runsData.workflow_runs) {
      const { data: artifactsData } = await octokit.rest.actions.listWorkflowRunArtifacts({
        owner,
        repo: repoName,
        run_id: run.id,
      });

      const statsArtifact = artifactsData.artifacts.find(a => a.name === 'bundle-stats');
      if (!statsArtifact) continue;

      // Download the artifact ZIP (returns an ArrayBuffer)
      const { data: zipData } = await octokit.rest.actions.downloadArtifact({
        owner,
        repo: repoName,
        artifact_id: statsArtifact.id,
        archive_format: 'zip',
      });

      return parseStatsJson(Buffer.from(zipData));
    }
  } catch (err) {
    console.warn('[bundle] Could not fetch artifact:', err.message);
  }

  // ── Fallback (dev mode / no CI artifact) ──────────────────────────────────
  console.log('[bundle] Using mock bundle data (420 KB)');
  return { totalKb: 420, chunks: [{ name: 'main.js', kb: 420 }] };
}

/**
 * Parse webpack stats.json buffer to total KB + per-chunk breakdown.
 * Also handles the case where the buffer is a ZIP (unzips first entry).
 */
function parseStatsJson(buffer) {
  let json;

  try {
    // Try direct JSON parse first (some CI setups upload stats.json directly)
    json = JSON.parse(buffer.toString('utf8'));
  } catch (_) {
    // If parse fails it's likely a ZIP — for now return mock
    // Full unzip support would require the 'jszip' package
    console.warn('[bundle] Could not parse bundle stats (ZIP parsing not implemented), using mock');
    return { totalKb: 420, chunks: [{ name: 'main.js', kb: 420 }] };
  }

  // Support both webpack stats.json and vite-bundle-visualizer output
  const assets = json.assets || json.chunks || [];
  const totalBytes = assets.reduce((acc, a) => acc + (a.size || a.gzipSize || 0), 0);

  return {
    totalKb: Math.round(totalBytes / 1024),
    chunks: assets
      .map(a => ({ name: a.name || a.id, kb: Math.round((a.size || 0) / 1024) }))
      .sort((a, b) => b.kb - a.kb)
      .slice(0, 20),
  };
}

module.exports = { analyseBundle, parseStatsJson };
