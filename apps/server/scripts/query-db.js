/**
 * query-db.js — Dev utility script
 *
 * Usage:
 *   node apps/server/scripts/query-db.js [repo_id]
 *
 * If no repo_id is given, lists all repos then shows the latest 10 checks
 * for the first one found.
 */

const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const repoId = process.argv[2] || null;

  try {
    if (repoId) {
      const checksRes = await pool.query(
        'SELECT * FROM checks WHERE repo_id = $1 ORDER BY created_at DESC LIMIT 20',
        [repoId]
      );
      console.log(`Found ${checksRes.rows.length} checks for repo ${repoId}:`);
      checksRes.rows.forEach(c => console.log(c));
    } else {
      // List all repos first
      const reposRes = await pool.query('SELECT id, owner, name, created_at FROM repos ORDER BY created_at DESC');
      console.log(`Found ${reposRes.rows.length} repos:`);
      reposRes.rows.forEach(r => console.log(`  ${r.id}  ${r.owner}/${r.name}`));

      if (reposRes.rows.length > 0) {
        const first = reposRes.rows[0];
        console.log(`\nLatest 10 checks for ${first.owner}/${first.name} (${first.id}):`);
        const checksRes = await pool.query(
          'SELECT id, pr_number, status, head_sha, created_at FROM checks WHERE repo_id = $1 ORDER BY created_at DESC LIMIT 10',
          [first.id]
        );
        checksRes.rows.forEach(c => console.log(c));
      }
    }
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
