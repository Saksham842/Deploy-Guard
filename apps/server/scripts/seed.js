/**
 * DeployGuard — Seed Script
 * Populates the database with realistic test data for local development.
 *
 * Usage: node apps/server/scripts/seed.js
 *        (requires DATABASE_URL in env or .env file)
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  const client = await pool.connect();
  console.log('🌱 Starting seed...\n');

  try {
    await client.query('BEGIN');

    // ── 1. Insert test repo ──────────────────────────────────────────────────
    const { rows: repoRows } = await client.query(
      `INSERT INTO repos (github_repo_id, owner, name, install_id, threshold_config)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (github_repo_id) DO UPDATE
         SET owner = EXCLUDED.owner, name = EXCLUDED.name
       RETURNING *`,
      [
        123456789,
        'octocat',
        'my-react-app',
        98765432,
        JSON.stringify({ bundle_kb: 10, query_count: 20, api_p95_ms: 200 }),
      ]
    );
    const repo = repoRows[0];
    console.log(`✅ Repo: ${repo.owner}/${repo.name} (id: ${repo.id})`);

    // ── 2. Insert 20 baseline records over the last 30 days ─────────────────
    const metrics = ['bundle_kb', 'query_count', 'api_p95_ms'];
    const metricRanges = {
      bundle_kb:   { base: 380, variance: 40 },
      query_count: { base: 12,  variance: 5  },
      api_p95_ms:  { base: 145, variance: 30 },
    };

    let baselineCount = 0;
    for (let i = 0; i < 20; i++) {
      const daysAgo  = 30 - i * 1.5;
      const date     = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      const sha      = randomSha();

      for (const metric of metrics) {
        const { base, variance } = metricRanges[metric];
        // Gradual upward drift to simulate real bundle growth
        const drift = i * (variance * 0.05);
        const value = base + drift + (Math.random() * variance - variance / 2);

        await client.query(
          `INSERT INTO baselines (repo_id, branch, metric, value, commit_sha, recorded_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (repo_id, branch, metric) DO UPDATE
             SET value = EXCLUDED.value, commit_sha = EXCLUDED.commit_sha, recorded_at = EXCLUDED.recorded_at`,
          [repo.id, 'main', metric, Math.round(value * 10) / 10, sha, date]
        );
        baselineCount++;
      }
    }
    console.log(`✅ Baselines: ${baselineCount} records inserted`);

    // ── 3. Insert 10 check records (mixed pass/fail) ─────────────────────────
    const checkData = [
      { pr: 42, status: 'pass',  bundle_before: 390, bundle_after: 392, delta: 0.5  },
      { pr: 43, status: 'fail',  bundle_before: 392, bundle_after: 455, delta: 16.1 },
      { pr: 44, status: 'pass',  bundle_before: 392, bundle_after: 395, delta: 0.8  },
      { pr: 45, status: 'fail',  bundle_before: 395, bundle_after: 430, delta: 8.9  },
      { pr: 46, status: 'pass',  bundle_before: 395, bundle_after: 396, delta: 0.3  },
      { pr: 47, status: 'pass',  bundle_before: 396, bundle_after: 398, delta: 0.5  },
      { pr: 48, status: 'fail',  bundle_before: 398, bundle_after: 478, delta: 20.1 },
      { pr: 49, status: 'pass',  bundle_before: 398, bundle_after: 401, delta: 0.8  },
      { pr: 50, status: 'pass',  bundle_before: 401, bundle_after: 403, delta: 0.5  },
      { pr: 51, status: 'error', bundle_before: 403, bundle_after: null, delta: 0   },
    ];

    const checkIds = [];
    for (let i = 0; i < checkData.length; i++) {
      const d       = checkData[i];
      const daysAgo = (10 - i) * 2.5;
      const date    = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      const results = d.bundle_after
        ? { bundle_kb: { before: d.bundle_before, after: d.bundle_after, delta: d.delta } }
        : null;

      const { rows: checkRows } = await client.query(
        `INSERT INTO checks (repo_id, pr_number, head_sha, base_sha, status, results, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [repo.id, d.pr, randomSha(), randomSha(), d.status, JSON.stringify(results), date]
      );
      checkIds.push({ id: checkRows[0].id, status: d.status, delta: d.delta });
    }
    console.log(`✅ Checks: ${checkIds.length} records inserted`);

    // ── 4. Insert regression_causes for failed checks ─────────────────────────
    const causeTemplates = [
      { cause_type: 'new_dependency', detail: 'Added packages: lodash, date-fns',         confidence: 0.95 },
      { cause_type: 'asset_added',    detail: 'Added high-res product images to public/', confidence: 0.82 },
      { cause_type: 'feature',        detail: 'Commit: "implement rich text editor with tiptap"', confidence: 0.78 },
      { cause_type: 'new_dependency', detail: 'Added packages: @sentry/react',             confidence: 0.95 },
      { cause_type: 'refactor',       detail: 'Commit: "migrate to react-router v6"',      confidence: 0.65 },
    ];

    let causeCount = 0;
    for (const check of checkIds.filter(c => c.status === 'fail')) {
      // Assign 1-2 causes per failed check
      const numCauses = Math.random() > 0.5 ? 2 : 1;
      for (let i = 0; i < numCauses; i++) {
        const template = causeTemplates[Math.floor(Math.random() * causeTemplates.length)];
        await client.query(
          `INSERT INTO regression_causes (check_id, cause_type, detail, confidence)
           VALUES ($1, $2, $3, $4)`,
          [check.id, template.cause_type, template.detail, template.confidence]
        );
        causeCount++;
      }
    }
    console.log(`✅ Causes: ${causeCount} records inserted`);

    await client.query('COMMIT');
    console.log('\n🎉 Seed complete!');
    console.log(`   Repo:      ${repo.owner}/${repo.name}`);
    console.log(`   Baselines: ${baselineCount}`);
    console.log(`   Checks:    ${checkIds.length}`);
    console.log(`   Causes:    ${causeCount}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Seed failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

function randomSha() {
  return [...Array(40)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
