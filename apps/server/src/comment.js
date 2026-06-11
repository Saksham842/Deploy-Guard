/**
 * Build the markdown PR comment body for DeployGuard results.
 */
function buildComment(metrics, causes, pkgDiff, aiExplanation) {
  const allPassed = metrics.every(m => m.passed);
  const topEmoji  = allPassed ? '🟢' : '🔴';

  let md = `## ${topEmoji} DeployGuard Performance Report\n\n`;

  // ── Metrics table ──────────────────────────────────────────────────────────
  md += `| Metric | Before | After | Delta | Status |\n`;
  md += `|--------|--------|-------|-------|--------|\n`;

  if (metrics.length === 0) {
    md += `| Bundle Size | — | — | n/a | ⚫ No CI artifact — add a bundle-stats upload step to your workflow |\n`;
  }

  for (const m of metrics) {
    const before  = m.before !== null ? `${m.before} ${m.unit}` : '—';
    const after   = m.after  !== null ? `${m.after} ${m.unit}`  : '—';
    const sign    = m.delta > 0 ? '+' : '';
    const deltaStr = m.before !== null ? `${sign}${m.delta.toFixed(1)}%` : 'n/a (first run)';
    const statusEmoji = m.before === null ? '⚪' : m.passed ? '✅' : '❌';

    md += `| ${m.label} | ${before} | ${after} | ${deltaStr} | ${statusEmoji} |\n`;
  }
  md += '\n';

  // ── Regression causes (NLP) ────────────────────────────────────────────────
  if (causes.length > 0) {
    md += `### 🧠 Probable causes (NLP analysis)\n\n`;
    for (const c of causes) {
      const conf  = Math.round(c.confidence * 100);
      const label = c.cause_type.replace(/_/g, ' ');
      md += `- **${label}** (${conf}% confidence): ${c.detail}\n`;
    }
    md += '\n';
  }

  // ── New packages ───────────────────────────────────────────────────────────
  if (pkgDiff.added && pkgDiff.added.length > 0) {
    md += `### 📦 New packages added\n`;
    pkgDiff.added.forEach(p => { md += `- \`${p}\`\n`; });
    md += '\n';
  }

  if (pkgDiff.removed && pkgDiff.removed.length > 0) {
    md += `### 🗑️ Packages removed\n`;
    pkgDiff.removed.forEach(p => { md += `- \`${p}\`\n`; });
    md += '\n';
  }

  if (pkgDiff.upgraded && pkgDiff.upgraded.length > 0) {
    md += `### ⬆️ Packages upgraded\n`;
    pkgDiff.upgraded.forEach(p => { md += `- \`${p.name}\`: \`${p.from}\` → \`${p.to}\`\n`; });
    md += '\n';
  }

  // ── AI explanation ──────────────────────────────────────────────────────────
  if (aiExplanation) {
    md += `### 🤖 DeployGuard AI Analysis\n\n${aiExplanation}\n\n`;
  }

  // ── Footer ─────────────────────────────────────────────────────────────────
  md += `---\n`;
  md += `*[DeployGuard](${process.env.DASHBOARD_URL || 'https://deploy-guard-web.vercel.app'}) — `;
  if (metrics.length > 0) {
    md += `Threshold: bundle ±${metrics[0]?.threshold ?? 10}% | `;
  }
  md += `Powered by NLP causation engine*`;

  return md;
}

/**
 * Build a short one-paragraph summary for the check run output.
 */
function buildSummary(metrics, causes) {
  const failingMetrics = metrics.filter(m => !m.passed && m.before !== null);

  if (failingMetrics.length === 0) {
    return '✅ All metrics are within acceptable thresholds. No action required.';
  }

  let summary = '### Failing metrics\n\n';
  for (const m of failingMetrics) {
    const sign = m.delta > 0 ? '+' : '';
    summary += `- **${m.label}**: ${sign}${m.delta.toFixed(1)}% (threshold: ±${m.threshold}%)\n`;
  }

  if (causes.length > 0) {
    summary += '\n### Top probable cause\n\n';
    const top = causes[0];
    summary += `**${top.cause_type.replace(/_/g, ' ')}** — ${top.detail} `;
    summary += `(${Math.round(top.confidence * 100)}% confidence)`;
  }

  return summary;
}

module.exports = { buildComment, buildSummary };
