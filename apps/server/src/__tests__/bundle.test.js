const JSZip = require('jszip');
const { analyseBundle, parseStatsJson, computeChunkDiff } = require('../analysers/bundle');

describe('Phase 0.2: Bundle Analyser & Retry Logic (analysers/bundle.js)', () => {
  test('parseStatsJson parses raw stats JSON buffer', async () => {
    const raw = JSON.stringify({
      assets: [
        { name: 'main.js', size: 102400 },
        { name: 'vendor.js', size: 204800 },
      ],
    });
    const result = await parseStatsJson(Buffer.from(raw));
    expect(result.totalKb).toBe(300);
    expect(result.chunks).toHaveLength(2);
    expect(result.chunks[0].name).toBe('vendor.js');
    expect(result.chunks[0].kb).toBe(200);
    expect(result.chunks[1].name).toBe('main.js');
    expect(result.chunks[1].kb).toBe(100);
  });

  test('parseStatsJson parses stats.json inside a ZIP buffer', async () => {
    const zip = new JSZip();
    zip.file(
      'stats.json',
      JSON.stringify({
        assets: [{ name: 'bundle.js', size: 51200 }],
      })
    );
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    const result = await parseStatsJson(zipBuffer);
    expect(result.totalKb).toBe(50);
    expect(result.chunks[0].name).toBe('bundle.js');
  });

  test('parseStatsJson returns totalKb: null when stats.json is missing in ZIP', async () => {
    const zip = new JSZip();
    zip.file('other.txt', 'hello');
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    const result = await parseStatsJson(zipBuffer);
    expect(result.totalKb).toBeNull();
    expect(result.source).toBe('no-stats-json');
  });

  test('analyseBundle retries on downloadArtifact failures and succeeds on subsequent attempt', async () => {
    const zip = new JSZip();
    zip.file('stats.json', JSON.stringify({ assets: [{ name: 'app.js', size: 10240 }] }));
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    let attempts = 0;
    const octokit = {
      rest: {
        actions: {
          listWorkflowRunsForRepo: jest.fn().mockResolvedValue({
            data: { workflow_runs: [{ id: 100 }] },
          }),
          listWorkflowRunArtifacts: jest.fn().mockResolvedValue({
            data: { artifacts: [{ id: 555, name: 'bundle-stats' }] },
          }),
          downloadArtifact: jest.fn().mockImplementation(() => {
            attempts++;
            if (attempts < 2) {
              return Promise.reject(new Error('Artifact not ready'));
            }
            return Promise.resolve({ data: zipBuffer });
          }),
        },
      },
    };

    const res = await analyseBundle(octokit, { owner: { login: 'acme' }, name: 'repo' }, 'head-sha-1');
    expect(attempts).toBe(2);
    expect(res.totalKb).toBe(10);
  });
});

describe('Phase 2: Unified Bundler Normalization (normalizeStats)', () => {
  const { normalizeStats } = require('../analysers/bundle');

  test('normalizes Vite stats with explicit format "vite"', () => {
    const raw = {
      format: 'vite',
      assets: [
        { name: 'index.js', size: 153600 },
        { name: 'vendor.js', size: 512000 },
      ],
    };
    const res = normalizeStats(raw);
    expect(res.format).toBe('vite');
    expect(res.totalKb).toBe(650);
    expect(res.chunks[0].name).toBe('vendor.js');
    expect(res.chunks[0].kb).toBe(500);
    expect(res.chunks[1].name).toBe('index.js');
    expect(res.chunks[1].kb).toBe(150);
  });

  test('normalizes Next.js stats with explicit format "nextjs" and asset list', () => {
    const raw = {
      format: 'nextjs',
      assets: [
        { name: 'static/chunks/main-app.js', size: 204800 },
        { name: 'static/chunks/framework.js', size: 307200 },
      ],
    };
    const res = normalizeStats(raw);
    expect(res.format).toBe('nextjs');
    expect(res.totalKb).toBe(500);
    expect(res.chunks[0].name).toBe('static/chunks/framework.js');
    expect(res.chunks[0].kb).toBe(300);
  });

  test('normalizes Next.js build-manifest with pages and file sizes mapping', () => {
    const raw = {
      format: 'nextjs',
      polyfillFiles: ['static/chunks/polyfills.js'],
      rootMainFiles: ['static/chunks/main.js'],
      pages: {
        '/': ['static/chunks/pages/index.js'],
        '/about': ['static/chunks/pages/about.js'],
      },
      files: {
        'static/chunks/polyfills.js': 102400,
        'static/chunks/main.js': 204800,
        'static/chunks/pages/index.js': 51200,
        'static/chunks/pages/about.js': 51200,
      },
    };
    const res = normalizeStats(raw);
    expect(res.format).toBe('nextjs');
    expect(res.totalKb).toBe(400); // (100 + 200 + 50 + 50)
    expect(res.chunks.length).toBe(4);
  });

  test('normalizes native Webpack stats.json with top-level assets array', () => {
    const raw = {
      format: 'webpack',
      assets: [
        { name: 'bundle.js', size: 1048576 },
        { name: 'runtime.js', size: 10240 },
      ],
    };
    const res = normalizeStats(raw);
    expect(res.format).toBe('webpack');
    expect(res.totalKb).toBe(1034); // ~1024 + 10
    expect(res.chunks[0].name).toBe('bundle.js');
    expect(res.chunks[0].kb).toBe(1024);
  });

  test('backfills missing format by defaulting to "vite"', () => {
    const rawLegacy = {
      assets: [
        { name: 'app.js', size: 204800 },
      ],
    };
    const res = normalizeStats(rawLegacy);
    expect(res.format).toBe('vite');
    expect(res.totalKb).toBe(200);
  });

  test('returns zero-bytes source when assets array is empty or zero total bytes', () => {
    const rawEmpty = { format: 'vite', assets: [] };
    const res = normalizeStats(rawEmpty);
    expect(res.totalKb).toBeNull();
    expect(res.source).toBe('zero-bytes');
  });

  test('handles invalid or non-object input gracefully', () => {
    expect(normalizeStats(null).totalKb).toBeNull();
    expect(normalizeStats(undefined).totalKb).toBeNull();
    expect(normalizeStats('not an object').totalKb).toBeNull();
  });

  describe('Phase 4.2: computeChunkDiff', () => {
    test('computes top 5 chunk deltas sorted by absolute delta', () => {
      const baseChunks = [
        { name: 'app.js', bytes: 100000 },
        { name: 'vendor.js', bytes: 200000 },
        { name: 'utils.js', bytes: 50000 },
        { name: 'icon.js', bytes: 10000 },
      ];
      const headChunks = [
        { name: 'app.js', bytes: 150000 },      // +50000
        { name: 'vendor.js', bytes: 280000 },   // +80000
        { name: 'utils.js', bytes: 30000 },     // -20000
        { name: 'new-dep.js', bytes: 120000 },  // +120000
        { name: 'icon.js', bytes: 10500 },      // +500
        { name: 'tiny.js', bytes: 100 },        // +100
      ];

      const diff = computeChunkDiff(headChunks, baseChunks);
      expect(diff).toHaveLength(5);
      expect(diff[0].chunk_name).toBe('new-dep.js');
      expect(diff[0].before_bytes).toBe(0);
      expect(diff[0].after_bytes).toBe(120000);

      expect(diff[1].chunk_name).toBe('vendor.js');
      expect(diff[1].before_bytes).toBe(200000);
      expect(diff[1].after_bytes).toBe(280000);

      expect(diff[2].chunk_name).toBe('app.js');
      expect(diff[3].chunk_name).toBe('utils.js');
      expect(diff[3].before_bytes).toBe(50000);
      expect(diff[3].after_bytes).toBe(30000);

      expect(diff[4].chunk_name).toBe('icon.js');
    });

    test('handles empty base or head gracefully', () => {
      expect(computeChunkDiff([], [])).toEqual([]);
      expect(computeChunkDiff(null, null)).toEqual([]);
      const headOnly = [{ name: 'bundle.js', bytes: 50000 }];
      const diff = computeChunkDiff(headOnly, []);
      expect(diff).toHaveLength(1);
      expect(diff[0]).toEqual({
        chunk_name: 'bundle.js',
        before_bytes: 0,
        after_bytes: 50000,
      });
    });
  });
});
