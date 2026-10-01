# ⚡ DeployGuard Query Tracking Guide

DeployGuard detects **N+1 query regressions** and sudden increases in database query volume during Pull Requests.

---

## 📦 How It Works

1. During test suite execution (e.g., Jest, Vitest, Mocha), an ORM middleware or listener records the total number of database queries executed.
2. An `afterAll` hook writes the total query count to `dist/query-stats.json`.
3. The CI workflow uploads `dist/` as a `bundle-stats` artifact containing both `stats.json` and `query-stats.json`.
4. DeployGuard calculates the percentage delta against your base branch baseline and fails the PR if the increase exceeds your threshold.

---

## 🛠️ Setup: Prisma Middleware Hook

Add the following snippet to your test setup file (e.g. `tests/setup.ts` or `jest.setup.js`):

```javascript
import fs from 'fs';
import path from 'path';
import { prisma } from '../src/db'; // Your Prisma Client instance

let queryCount = 0;

// Intercept queries and count executions
prisma.$use(async (params, next) => {
  queryCount++;
  return next(params);
});

// Write stats when test suite finishes
afterAll(() => {
  const distDir = path.resolve(process.cwd(), 'dist');
  fs.mkdirSync(distDir, { recursive: true });
  fs.writeFileSync(
    path.join(distDir, 'query-stats.json'),
    JSON.stringify({ queryCount }, null, 2)
  );
  console.log(`[DeployGuard] Recorded ${queryCount} total queries to dist/query-stats.json`);
});
```

---

## ⚙️ Enabling Query Tracking in DeployGuard

Query tracking is **opt-in** so existing bundle tracking is never blocked by unconfigured query metrics.

To enable query regression gates:
1. Open your repository in the **DeployGuard Dashboard**.
2. Navigate to **Threshold Config** (`PUT /api/repos/:owner/:name/thresholds`).
3. Set `query_tracking_enabled: true` and specify your desired tolerance (default: `20`% max regression):

```json
{
  "bundle_kb": 10,
  "query_count": 20,
  "query_tracking_enabled": true
}
```
