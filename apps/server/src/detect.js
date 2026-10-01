/**
 * detect.js — Build tool detection for DeployGuard onboarding
 *
 * Inspects the default branch package.json of a newly-installed repo to
 * determine which bundler the project uses. The result is stored in
 * repos.build_tool and drives the workflow template generator.
 *
 * Detection priority (first match wins):
 *   next        → "nextjs"
 *   vite        → "vite"
 *   webpack     → "webpack"
 *   react-scripts → "cra"
 *   (none)      → "unknown"
 */

/**
 * Detect the build tool for a given repo by reading its package.json.
 *
 * @param {import('@octokit/rest').Octokit} octokit - Authenticated Octokit instance
 * @param {string} owner  - GitHub owner login
 * @param {string} repo   - Repository name
 * @param {string} branch - Default branch name (e.g. "main")
 * @returns {Promise<string>} One of: "nextjs" | "vite" | "webpack" | "cra" | "unknown"
 */
async function detectBuildTool(octokit, owner, repo, branch = 'main') {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: 'package.json',
      ref: branch,
    });

    const raw = Buffer.from(data.content, 'base64').toString('utf8');
    const pkg = JSON.parse(raw);

    const deps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };

    if (deps['next'])          return 'nextjs';
    if (deps['vite'])          return 'vite';
    if (deps['webpack'])       return 'webpack';
    if (deps['react-scripts']) return 'cra';

    return 'unknown';
  } catch (err) {
    console.warn(`[detect] Could not read package.json for ${owner}/${repo}@${branch}: ${err.message}`);
    return 'unknown';
  }
}

/**
 * Fetch the default branch name for a repo.
 *
 * @param {import('@octokit/rest').Octokit} octokit
 * @param {string} owner
 * @param {string} repo
 * @returns {Promise<string>} Default branch name, falls back to "main"
 */
async function getDefaultBranch(octokit, owner, repo) {
  try {
    const { data } = await octokit.rest.repos.get({ owner, repo });
    return data.default_branch || 'main';
  } catch {
    return 'main';
  }
}

module.exports = { detectBuildTool, getDefaultBranch };
