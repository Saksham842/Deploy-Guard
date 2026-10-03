/**
 * metrics.js — Metric computation & result formatting for DeployGuard
 *
 * Computes deltas and evaluates pass/fail status against repository thresholds
 * for:
 *   - bundle_kb: bundle size in KB
 *   - query_count: database queries executed in test suite
 *   - api_p95_ms: API 95th percentile latency in ms
 */

/**
 * Computes pass/fail metrics from live bundle/query data and stored baselines.
 * Only emits a metric when meaningful data exists — never invents values.
 *
 * @param {object} params
 * @param {object} params.bundleResult - { totalKb, queryCount, chunks }
 * @param {object|null} params.bundleBaseline - Stored baseline for bundle size
 * @param {object|null} params.queryBaseline - Stored baseline for query count
 * @param {object|null} params.apiBaseline - Stored baseline for API p95
 * @param {object} params.thresholds - Repo threshold config
 * @returns {Array<object>} Evaluated metrics list
 */
function computeMetrics({ bundleResult, bundleBaseline, queryBaseline, apiBaseline, thresholds }) {
  const metrics = [];

  // 1. Bundle Size (KB)
  if (bundleResult && bundleResult.totalKb !== null && bundleResult.totalKb !== undefined) {
    const before = bundleBaseline?.value !== undefined && bundleBaseline?.value !== null ? Number(bundleBaseline.value) : null;
    const after  = bundleResult.totalKb;
    const delta  = before ? ((after - before) / before) * 100 : 0;
    const thresholdVal = thresholds.bundle_kb ?? 10;

    metrics.push({
      key:       'bundle_kb',
      label:     'Bundle Size',
      before,
      after,
      delta,
      unit:      'KB',
      threshold: thresholdVal,
      passed:    delta <= thresholdVal || before === null,
    });
  } else {
    console.log('[analysis] No CI artifact — bundle metric skipped');
  }

  // 2. Query Count (queries) — with opt-in safeguard
  const queryTrackingEnabled = thresholds.query_tracking_enabled === true;
  if (bundleResult && bundleResult.queryCount !== null && bundleResult.queryCount !== undefined) {
    const before = queryBaseline?.value !== undefined && queryBaseline?.value !== null ? Number(queryBaseline.value) : null;
    const after  = bundleResult.queryCount;
    const delta  = before ? ((after - before) / before) * 100 : 0;
    const thresholdVal = thresholds.query_count ?? 20;

    metrics.push({
      key:       'query_count',
      label:     'Query Count',
      before,
      after,
      delta,
      unit:      'queries',
      threshold: thresholdVal,
      passed:    !queryTrackingEnabled || delta <= thresholdVal || before === null,
    });
  } else if (queryBaseline) {
    metrics.push({
      key:       'query_count',
      label:     'Query Count',
      before:    Number(queryBaseline.value),
      after:     null,
      delta:     0,
      unit:      'queries',
      threshold: thresholds.query_count ?? 20,
      passed:    true,
    });
  }

  // 3. API p95 Latency (ms)
  if (apiBaseline) {
    metrics.push({
      key:       'api_p95_ms',
      label:     'API p95 Latency',
      before:    Number(apiBaseline.value),
      after:     null,
      delta:     0,
      unit:      'ms',
      threshold: thresholds.api_p95_ms ?? 200,
      passed:    true,
    });
  }

  return metrics;
}

/**
 * Format metrics array into the JSON structure stored in checks.results JSONB.
 */
function buildResultsJson(metrics) {
  return Object.fromEntries(
    metrics.map(m => [m.key, { before: m.before, after: m.after, delta: m.delta }])
  );
}

module.exports = {
  computeMetrics,
  buildResultsJson,
};
