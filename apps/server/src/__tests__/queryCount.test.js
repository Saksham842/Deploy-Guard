const JSZip = require('jszip');
const { parseStatsJson } = require('../analysers/bundle');
const { computeMetrics } = require('../metrics');

describe('Phase 3: query_count Pipeline & Metric Computation', () => {
  test('parseStatsJson extracts queryCount from query-stats.json in ZIP', async () => {
    const zip = new JSZip();
    zip.file('stats.json', JSON.stringify({ format: 'vite', assets: [{ name: 'bundle.js', size: 102400 }] }));
    zip.file('query-stats.json', JSON.stringify({ queryCount: 42 }));
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });

    const result = await parseStatsJson(buffer);
    expect(result.totalKb).toBe(100);
    expect(result.queryCount).toBe(42);
  });

  test('parseStatsJson handles missing query-stats.json gracefully', async () => {
    const zip = new JSZip();
    zip.file('stats.json', JSON.stringify({ format: 'vite', assets: [{ name: 'bundle.js', size: 102400 }] }));
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });

    const result = await parseStatsJson(buffer);
    expect(result.totalKb).toBe(100);
    expect(result.queryCount).toBeNull();
  });

  describe('computeMetrics with query_count', () => {
    const defaultThresholds = {
      bundle_kb: 10,
      query_count: 20, // 20% regression allowed
      query_tracking_enabled: true,
    };

    test('computes query_count delta correctly when queries regress', () => {
      const metrics = computeMetrics({
        bundleResult: { totalKb: 100, queryCount: 50 },
        bundleBaseline: { value: 100 },
        queryBaseline: { value: 25 }, // 25 -> 50 (+100% regression)
        apiBaseline: null,
        thresholds: defaultThresholds,
      });

      const queryMetric = metrics.find(m => m.key === 'query_count');
      expect(queryMetric).toBeDefined();
      expect(queryMetric.before).toBe(25);
      expect(queryMetric.after).toBe(50);
      expect(queryMetric.delta).toBe(100);
      expect(queryMetric.passed).toBe(false); // +100% > 20%
    });

    test('passes query_count when regression is within threshold', () => {
      const metrics = computeMetrics({
        bundleResult: { totalKb: 100, queryCount: 22 },
        bundleBaseline: { value: 100 },
        queryBaseline: { value: 20 }, // 20 -> 22 (+10% regression)
        apiBaseline: null,
        thresholds: defaultThresholds,
      });

      const queryMetric = metrics.find(m => m.key === 'query_count');
      expect(queryMetric.delta).toBe(10);
      expect(queryMetric.passed).toBe(true);
    });

    test('does NOT fail check if query_tracking_enabled is false (opt-in safeguard)', () => {
      const metrics = computeMetrics({
        bundleResult: { totalKb: 100, queryCount: 100 },
        bundleBaseline: { value: 100 },
        queryBaseline: { value: 10 }, // +900% regression!
        apiBaseline: null,
        thresholds: {
          ...defaultThresholds,
          query_tracking_enabled: false, // opt-in disabled
        },
      });

      const queryMetric = metrics.find(m => m.key === 'query_count');
      expect(queryMetric.delta).toBe(900);
      expect(queryMetric.passed).toBe(true); // Should pass because opt-in is false
    });

    test('passes when no baseline exists yet (first run)', () => {
      const metrics = computeMetrics({
        bundleResult: { totalKb: 100, queryCount: 30 },
        bundleBaseline: { value: 100 },
        queryBaseline: null,
        apiBaseline: null,
        thresholds: defaultThresholds,
      });

      const queryMetric = metrics.find(m => m.key === 'query_count');
      expect(queryMetric.before).toBeNull();
      expect(queryMetric.after).toBe(30);
      expect(queryMetric.passed).toBe(true);
    });
  });
});
