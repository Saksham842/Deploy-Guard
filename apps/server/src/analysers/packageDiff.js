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
  // Try the monorepo web sub-package first (most relevant for bundle size).
  // Fall back to the root package.json for non-monorepo repos.
  const candidates = ['apps/web/package.json', 'package.json'];

  for (const pkgPath of candidates) {
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: pkgPath,
        ref,
      });
      const decoded = Buffer.from(data.content, 'base64').toString('utf8');
      return JSON.parse(decoded);
    } catch (err) {
      if (err.status === 404) continue; // try next candidate
      console.warn(`[packageDiff] Could not fetch ${pkgPath} at ${ref}:`, err.message);
    }
  }

  return null; // no package.json found in any known location
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
