/**
 * bundle.js — GitHub Actions artifact downloader and bundle size extractor
 *
 * Searches completed workflow runs for a "bundle-stats" artifact, downloads
 * the ZIP, and parses stats.json into a normalised result object. Returns
 * { totalKb: null } when no artifact is found so callers can display
 * "no data" rather than surfacing a misleading zero.
 *
 * Supports both raw JSON uploads and the ZIP-wrapped format that
 * actions/upload-artifact@v4 produces by default.
 */

const JSZip = require('jszip');

/**
 * @param {import('@octokit/rest').Octokit} octokit
 * @param {{ owner: { login: string }, name: string }} repository
 * @param {string} sha  - Head commit SHA to search artifacts for
 * @returns {Promise<{ totalKb: number|null, chunks: Array, source: string }>}
 */
async function analyseBundle(octokit, repository, sha) {
  const owner    = repository.owner.login;
  const repoName = repository.name;

  try {
    const { data: runsData } = await octokit.rest.actions.listWorkflowRunsForRepo({
      owner,
      repo:     repoName,
      head_sha: sha,
      per_page: 10,
      status:   'completed',
    });

    for (const run of runsData.workflow_runs) {
      const { data: artifactsData } = await octokit.rest.actions.listWorkflowRunArtifacts({
        owner, repo: repoName, run_id: run.id,
      });

      const artifact = artifactsData.artifacts.find(a => a.name === 'bundle-stats');
      if (!artifact) continue;

      const { data: zipData } = await octokit.rest.actions.downloadArtifact({
        owner, repo: repoName,
        artifact_id:    artifact.id,
        archive_format: 'zip',
      });

      return parseStatsJson(Buffer.from(zipData));
    }
  } catch (err) {
    console.warn('[bundle] Artifact fetch failed:', err.message);
  }

  console.log('[bundle] No bundle-stats artifact found — returning null');
  return { totalKb: null, chunks: [], source: 'no-artifact' };
}

/**
 * Parses a bundle stats buffer that is either raw JSON or a ZIP containing
 * stats.json (the format produced by actions/upload-artifact).
 */
async function parseStatsJson(buffer) {
  // Try raw JSON first — some CI setups upload the file directly
  try {
    return extractStats(JSON.parse(buffer.toString('utf8')));
  } catch { /* not raw JSON */ }

  // Unwrap ZIP
  try {
    const zip = await JSZip.loadAsync(buffer);
    const statsFile =
      zip.file('stats.json') ||
      Object.values(zip.files).find(f => !f.dir && f.name.endsWith('stats.json'));

    if (!statsFile) {
      console.warn('[bundle] stats.json not found inside artifact ZIP');
      return { totalKb: null, chunks: [], source: 'no-stats-json' };
    }

    return extractStats(JSON.parse(await statsFile.async('string')));
  } catch (err) {
    console.warn('[bundle] Failed to extract stats from ZIP:', err.message);
    return { totalKb: null, chunks: [], source: 'parse-error' };
  }
}

/**
 * Normalises a parsed stats.json object into DeployGuard's internal format.
 * Compatible with webpack stats.json and rollup-plugin-visualizer output.
 */
function extractStats(json) {
  const assets     = json.assets || json.chunks || [];
  const totalBytes = assets.reduce((acc, a) => acc + (a.size || a.gzipSize || 0), 0);

  if (totalBytes === 0) {
    console.warn('[bundle] stats.json reports zero bytes — no usable data');
    return { totalKb: null, chunks: [], source: 'zero-bytes' };
  }

  return {
    totalKb: Math.round(totalBytes / 1024),
    chunks:  assets
      .map(a => ({ name: a.name || a.id, kb: Math.round((a.size || 0) / 1024) }))
      .sort((a, b) => b.kb - a.kb)
      .slice(0, 20),
  };
}

module.exports = { analyseBundle, parseStatsJson };
