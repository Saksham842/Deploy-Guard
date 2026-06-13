#!/usr/bin/env node
/**
 * generate-stats.mjs
 *
 * Scans dist/assets after a Vite build and writes stats.json in the same
 * format as webpack stats.json — so DeployGuard can read it without any
 * extra plugins or dependencies.
 *
 * Only JS and CSS files are counted towards the reported bundle size to
 * avoid inflating the metric with images, fonts, HTML, etc.
 *
 * Usage (run from apps/web/):
 *   node scripts/generate-stats.mjs
 *
 * Output:
 *   dist/stats.json
 */

import { readdirSync, statSync, writeFileSync } from 'fs';
import { join, relative, extname } from 'path';
import { fileURLToPath } from 'url';

const __dirname   = fileURLToPath(new URL('.', import.meta.url));
const DIST_DIR    = join(__dirname, '../dist');
const ASSETS_DIR  = join(DIST_DIR, 'assets');
const OUTPUT_FILE = join(DIST_DIR, 'stats.json');

// Extensions that count towards the JS/CSS bundle size
const BUNDLE_EXTS = new Set(['.js', '.mjs', '.cjs', '.css']);

// ── Recursively collect all files under a directory ───────────────────────────
function walkDir(dir) {
  let results = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        results = results.concat(walkDir(fullPath));
      } else {
        results.push(fullPath);
      }
    }
  } catch {
    // assets dir may not exist if build output is flat
  }
  return results;
}

// ── Collect all files from dist/ (not just assets/) ──────────────────────────
function collectFiles() {
  const files = [];

  // Walk assets/ first (JS, CSS chunks)
  const assetFiles = walkDir(ASSETS_DIR);
  for (const filePath of assetFiles) {
    const { size } = statSync(filePath);
    const name     = relative(DIST_DIR, filePath).replace(/\\/g, '/');
    const isBundle = BUNDLE_EXTS.has(extname(filePath).toLowerCase());
    files.push({ name, size, isBundle });
  }

  // Also include root-level files (index.html, etc.) but mark them as non-bundle
  try {
    for (const entry of readdirSync(DIST_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        const fullPath = join(DIST_DIR, entry.name);
        const { size } = statSync(fullPath);
        files.push({ name: entry.name, size, isBundle: false });
      }
    }
  } catch { /* ignore */ }

  return files;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const assets = collectFiles();

if (assets.length === 0) {
  console.error('[generate-stats] No files found in dist/. Did the build succeed?');
  process.exit(1);
}

// Compute bundle total (JS + CSS only) and overall dist total
const bundleAssets  = assets.filter(a => a.isBundle);
const bundleBytes   = bundleAssets.reduce((sum, a) => sum + a.size, 0);
const totalBytes    = assets.reduce((sum, a) => sum + a.size, 0);
const bundleKb      = (bundleBytes / 1024).toFixed(1);
const totalKb       = (totalBytes / 1024).toFixed(1);

// Write webpack-compatible stats.json
// DeployGuard reads `assets[].size` — expose only bundle assets so the total
// matches what end-users actually download as JS/CSS.
const stats = { assets: bundleAssets };
writeFileSync(OUTPUT_FILE, JSON.stringify(stats, null, 2));

console.log(`[generate-stats] Wrote dist/stats.json`);
console.log(`[generate-stats] Bundle (JS+CSS): ${bundleAssets.length} files — ${bundleKb} KB`);
console.log(`[generate-stats] Dist total:      ${assets.length} files — ${totalKb} KB`);
bundleAssets
  .sort((a, b) => b.size - a.size)
  .slice(0, 10)
  .forEach(a => console.log(`  ${(a.size / 1024).toFixed(1).padStart(7)} KB  ${a.name}`));

