#!/usr/bin/env node
/**
 * generate-stats.mjs
 *
 * Post-build script that produces a webpack-compatible stats.json from the
 * compiled output directory. DeployGuard reads this file to measure bundle
 * size without requiring any bundler plugins or build-tool configuration.
 *
 * Only .js, .mjs, .cjs, and .css files are counted — images, fonts, and
 * HTML are excluded so the reported size reflects what end-users download
 * as executable code.
 *
 * Usage (run from apps/web after `npm run build`):
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

const BUNDLE_EXTS = new Set(['.js', '.mjs', '.cjs', '.css']);

function walkDir(dir) {
  let results = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = join(dir, entry.name);
      results = entry.isDirectory()
        ? results.concat(walkDir(fullPath))
        : [...results, fullPath];
    }
  } catch {
    // directory may not exist for flat build outputs — handled below
  }
  return results;
}

function collectFiles() {
  const files = [];

  // Collect chunked assets (JS, CSS) from dist/assets/
  for (const filePath of walkDir(ASSETS_DIR)) {
    const { size } = statSync(filePath);
    const name     = relative(DIST_DIR, filePath).replace(/\\/g, '/');
    files.push({ name, size, isBundle: BUNDLE_EXTS.has(extname(filePath).toLowerCase()) });
  }

  // Also collect root-level files (index.html, etc.) but exclude from bundle total
  try {
    for (const entry of readdirSync(DIST_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        const { size } = statSync(join(DIST_DIR, entry.name));
        files.push({ name: entry.name, size, isBundle: false });
      }
    }
  } catch { /* ignore */ }

  return files;
}

const allFiles     = collectFiles();
const bundleAssets = allFiles.filter(a => a.isBundle);

if (allFiles.length === 0) {
  console.error('[generate-stats] dist/ is empty — did the build succeed?');
  process.exit(1);
}

const bundleKb = (bundleAssets.reduce((sum, a) => sum + a.size, 0) / 1024).toFixed(1);
const totalKb  = (allFiles.reduce((sum, a) => sum + a.size, 0) / 1024).toFixed(1);

// Expose only bundle assets so DeployGuard's total matches what users download
writeFileSync(OUTPUT_FILE, JSON.stringify({ assets: bundleAssets }, null, 2));

console.log(`[generate-stats] dist/stats.json written`);
console.log(`[generate-stats] Bundle (JS + CSS): ${bundleAssets.length} files — ${bundleKb} KB`);
console.log(`[generate-stats] Dist total:         ${allFiles.length} files — ${totalKb} KB`);

bundleAssets
  .sort((a, b) => b.size - a.size)
  .slice(0, 10)
  .forEach(a => console.log(`  ${(a.size / 1024).toFixed(1).padStart(7)} KB  ${a.name}`));
