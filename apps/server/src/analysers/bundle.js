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

      const zipData = await downloadArtifactWithRetry(octokit, {
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
  return { totalKb: null, chunks: [], source: 'no-artifact', queryCount: null };
}

/**
 * Downloads artifact with 3 retries and exponential backoff (250ms, 1s, 4s).
 * Handles GitHub Actions artifact availability lag right after workflow finishes.
 */
async function downloadArtifactWithRetry(octokit, params, retries = 3, delays = [250, 1000, 4000]) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const { data } = await octokit.rest.actions.downloadArtifact(params);
      return data;
    } catch (err) {
      if (attempt < retries - 1) {
        const delay = delays[attempt] || 1000;
        console.warn(`[bundle] Artifact download attempt ${attempt + 1} failed: ${err.message} — retrying in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw err;
      }
    }
  }
}

/**
 * Parses a bundle stats buffer that is either raw JSON or a ZIP containing
 * stats.json (the format produced by actions/upload-artifact).
 */
async function parseStatsJson(buffer) {
  let queryCount = null;

  // Try raw JSON first — some CI setups upload the file directly
  try {
    const parsed = JSON.parse(buffer.toString('utf8'));
    if (typeof parsed.queryCount === 'number') {
      queryCount = parsed.queryCount;
    }
    const stats = normalizeStats(parsed, parsed.format);
    return { ...stats, queryCount };
  } catch { /* not raw JSON */ }

  // Unwrap ZIP
  try {
    const zip = await JSZip.loadAsync(buffer);
    const statsFile =
      zip.file('stats.json') ||
      Object.values(zip.files).find(f => !f.dir && f.name.endsWith('stats.json'));

    const queryFile =
      zip.file('query-stats.json') ||
      Object.values(zip.files).find(f => !f.dir && f.name.endsWith('query-stats.json'));

    if (queryFile) {
      try {
        const queryJson = JSON.parse(await queryFile.async('string'));
        if (typeof queryJson.queryCount === 'number') {
          queryCount = queryJson.queryCount;
        }
      } catch (err) {
        console.warn('[bundle] Failed to parse query-stats.json:', err.message);
      }
    }

    if (!statsFile) {
      console.warn('[bundle] stats.json not found inside artifact ZIP');
      return { totalKb: null, chunks: [], source: 'no-stats-json', queryCount };
    }

    const parsed = JSON.parse(await statsFile.async('string'));
    const stats = normalizeStats(parsed, parsed.format);
    return { ...stats, queryCount };
  } catch (err) {
    console.warn('[bundle] Failed to extract stats from ZIP:', err.message);
    return { totalKb: null, chunks: [], source: 'parse-error', queryCount: null };
  }
}

/**
 * Normalises raw bundler output into DeployGuard's internal representation:
 *   { totalKb: number | null, chunks: Array<{ name: string, kb: number }>, format: string }
 *
 * Supported formats:
 *   - 'vite':    assets[] with .name and .size (or legacy stats without format tag)
 *   - 'nextjs':  .next/build-manifest.json with file sizes or extracted assets[]
 *   - 'webpack': native webpack stats.json with top-level assets: [{ name, size }]
 *
 * Backfill: missing or unrecognized format defaults to 'vite' for full backward compatibility.
 */
function normalizeStats(rawJson, format) {
  if (!rawJson || typeof rawJson !== 'object') {
    return { totalKb: null, chunks: [], source: 'invalid-json' };
  }

  const detectedFormat = (format || rawJson.format || (rawJson.pages ? 'nextjs' : 'vite')).toLowerCase();

  switch (detectedFormat) {
    case 'nextjs':
      return normalizeNextjs(rawJson);
    case 'webpack':
    case 'cra':
      return normalizeWebpack(rawJson);
    case 'vite':
    default:
      return normalizeVite(rawJson);
  }
}

function normalizeVite(json) {
  const assets = json.assets || json.chunks || [];
  const totalBytes = assets.reduce((acc, a) => acc + (a.size || a.gzipSize || 0), 0);

  if (totalBytes === 0) {
    console.warn('[bundle] Vite stats reports zero bytes — no usable data');
    return { totalKb: null, chunks: [], source: 'zero-bytes', format: 'vite' };
  }

  return {
    totalKb: Math.round(totalBytes / 1024),
    chunks: assets
      .map(a => ({
        name: a.name || a.id || 'unnamed-chunk',
        kb: Math.round((a.size || 0) / 1024),
        bytes: typeof a.size === 'number' ? a.size : (a.gzipSize || Math.round((a.kb || 0) * 1024)),
      }))
      .sort((a, b) => b.kb - a.kb)
      .slice(0, 20),
    format: 'vite',
  };
}

function normalizeWebpack(json) {
  const assets = json.assets || json.chunks || [];
  const totalBytes = assets.reduce((acc, a) => acc + (a.size || a.gzipSize || 0), 0);

  if (totalBytes === 0) {
    console.warn('[bundle] Webpack stats reports zero bytes — no usable data');
    return { totalKb: null, chunks: [], source: 'zero-bytes', format: 'webpack' };
  }

  return {
    totalKb: Math.round(totalBytes / 1024),
    chunks: assets
      .map(a => ({
        name: a.name || a.id || 'unnamed-chunk',
        kb: Math.round((a.size || 0) / 1024),
        bytes: typeof a.size === 'number' ? a.size : (a.gzipSize || Math.round((a.kb || 0) * 1024)),
      }))
      .sort((a, b) => b.kb - a.kb)
      .slice(0, 20),
    format: 'webpack',
  };
}

function normalizeNextjs(json) {
  let assets = [];

  // Branch A: Pre-extracted assets array from workflow template
  if (Array.isArray(json.assets) && json.assets.length > 0) {
    assets = json.assets;
  }
  // Branch B: Raw .next/build-manifest.json with pages mapping & file sizes dictionary
  else if (json.pages && typeof json.pages === 'object') {
    const fileSizes = json.files || json.sizes || {};
    const uniqueFiles = new Set();

    if (Array.isArray(json.polyfillFiles)) {
      json.polyfillFiles.forEach(f => uniqueFiles.add(f));
    }
    if (Array.isArray(json.rootMainFiles)) {
      json.rootMainFiles.forEach(f => uniqueFiles.add(f));
    }

    Object.values(json.pages).forEach(pageFiles => {
      if (Array.isArray(pageFiles)) {
        pageFiles.forEach(f => uniqueFiles.add(f));
      }
    });

    assets = Array.from(uniqueFiles).map(fileName => ({
      name: fileName,
      size: fileSizes[fileName] || 0,
    }));
  }

  const totalBytes = assets.reduce((acc, a) => acc + (a.size || a.gzipSize || 0), 0);

  if (totalBytes === 0) {
    console.warn('[bundle] Next.js stats reports zero bytes — no usable data');
    return { totalKb: null, chunks: [], source: 'zero-bytes', format: 'nextjs' };
  }

  return {
    totalKb: Math.round(totalBytes / 1024),
    chunks: assets
      .map(a => ({
        name: a.name || 'unnamed-chunk',
        kb: Math.round((a.size || 0) / 1024),
        bytes: typeof a.size === 'number' ? a.size : (a.gzipSize || Math.round((a.kb || 0) * 1024)),
      }))
      .sort((a, b) => b.kb - a.kb)
      .slice(0, 20),
    format: 'nextjs',
  };
}

/**
 * Computes top 5 chunk deltas between base and head.
 * Returns Array<{ chunk_name: string, before_bytes: number, after_bytes: number }>
 */
function computeChunkDiff(headChunks = [], baseChunks = []) {
  if (!headChunks || headChunks.length === 0) return [];

  const baseMap = new Map();
  for (const c of (baseChunks || [])) {
    const name = c.name || c.chunk_name;
    const bytes = typeof c.bytes === 'number' ? c.bytes : ((c.kb || 0) * 1024);
    if (name) baseMap.set(name, bytes);
  }

  const headMap = new Map();
  for (const c of headChunks) {
    const name = c.name || c.chunk_name;
    const bytes = typeof c.bytes === 'number' ? c.bytes : ((c.kb || 0) * 1024);
    if (name) headMap.set(name, bytes);
  }

  const allNames = new Set([...headMap.keys(), ...baseMap.keys()]);
  const diffs = [];

  for (const name of allNames) {
    const beforeBytes = baseMap.get(name) || 0;
    const afterBytes = headMap.get(name) || 0;
    const delta = afterBytes - beforeBytes;
    diffs.push({
      chunk_name: name,
      before_bytes: beforeBytes,
      after_bytes: afterBytes,
      delta,
      abs_delta: Math.abs(delta),
    });
  }

  return diffs
    .sort((a, b) => b.abs_delta - a.abs_delta)
    .slice(0, 5)
    .map(({ chunk_name, before_bytes, after_bytes }) => ({
      chunk_name,
      before_bytes,
      after_bytes,
    }));
}

module.exports = { analyseBundle, parseStatsJson, normalizeStats, computeChunkDiff };
