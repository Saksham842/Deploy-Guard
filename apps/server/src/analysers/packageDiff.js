/**
 * package.json differ.
 *
 * Fetches package.json at baseSha and headSha via GitHub API,
 * then diffs dependencies + devDependencies.
 *
 * Returns: { added: string[], removed: string[], upgraded: {name, from, to}[] }
 */

async function diffPackageJson(octokit, repository, baseSha, headSha) {
  const owner    = repository.owner.login;
  const repoName = repository.name;

  const [basePkg, headPkg] = await Promise.all([
    fetchPackageJson(octokit, owner, repoName, baseSha),
    fetchPackageJson(octokit, owner, repoName, headSha),
  ]);

  if (!basePkg && !headPkg) return { added: [], removed: [], upgraded: [] };

  const baseDeps = mergeDeps(basePkg);
  const headDeps = mergeDeps(headPkg);

  const added    = [];
  const removed  = [];
  const upgraded = [];

  // Detect added + upgraded
  for (const [name, headVersion] of Object.entries(headDeps)) {
    if (!(name in baseDeps)) {
      added.push(name);
    } else if (baseDeps[name] !== headVersion) {
      upgraded.push({ name, from: baseDeps[name], to: headVersion });
    }
  }

  // Detect removed
  for (const name of Object.keys(baseDeps)) {
    if (!(name in headDeps)) {
      removed.push(name);
    }
  }

  return { added, removed, upgraded };
}

async function fetchPackageJson(octokit, owner, repo, ref) {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path: 'package.json',
      ref,
    });
    const decoded = Buffer.from(data.content, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (err) {
    // 404 = no package.json in this repo (non-Node project)
    if (err.status === 404) return null;
    console.warn(`[packageDiff] Could not fetch package.json at ${ref}:`, err.message);
    return null;
  }
}

/** Merge dependencies + devDependencies into a single flat map */
function mergeDeps(pkg) {
  if (!pkg) return {};
  return {
    ...(pkg.dependencies    || {}),
    ...(pkg.devDependencies || {}),
  };
}

module.exports = { diffPackageJson };
