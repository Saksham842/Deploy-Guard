import { useEffect, useState } from 'react';

export default function Docs() {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      title: 'Webhook Triggered',
      icon: '🔔',
      desc: 'GitHub sends a `pull_request.opened` event. Our Express backend securely verifies the HMAC-SHA256 signature.',
      code: `app.webhooks.on('pull_request.opened', handlePR);

// Verify signature
const signature = req.headers['x-hub-signature-256'];
verify(secret, payload, signature);`
    },
    {
      title: 'Fetch Performance Baseline',
      icon: '📊',
      desc: 'DeployGuard queries the PostgreSQL database to find the last known good performance baseline for the target branch.',
      code: `SELECT value 
FROM baselines 
WHERE repo_id = $1 
  AND branch = $2 
  AND metric = 'bundle_kb'
ORDER BY updated_at DESC LIMIT 1;`
    },
    {
      title: 'Analyze & Diff',
      icon: '⚡',
      desc: 'We fetch the new bundle size from CI artifacts and diff the package.json to see what dependencies changed.',
      code: `const bundleResult = await analyseBundle(octokit, headSha);
const pkgDiff = await diffPackageJson(octokit, baseSha, headSha);

// pkgDiff looks like:
// { added: ['lodash'], removed: [], upgraded: [] }`
    },
    {
      title: 'NLP Causation Engine',
      icon: '🧠',
      desc: 'A Python FastAPI microservice runs a LogisticRegression model on the commit messages and package diffs to explain the regression.',
      code: `# Python scikit-learn model
vectorizer = TfidfVectorizer()
X = vectorizer.fit_transform(commit_messages)
prediction = model.predict_proba(X)

return { "cause_type": "heavy_dependency", "confidence": 0.95 }`
    },
    {
      title: 'Threshold If/Else Logic',
      icon: '⚖️',
      desc: 'We compare the delta against the repository’s specific thresholds (e.g. ±10% bundle size).',
      code: `const bundleDelta = ((after - before) / before) * 100;
const passed = Math.abs(bundleDelta) <= thresholds.bundle_kb;

if (passed) {
  status = 'success';
} else {
  status = 'failure';
}`
    },
    {
      title: 'Update GitHub & Database',
      icon: '💾',
      desc: 'We post a native Check Run and comment on GitHub. If the PR merges to main, we update the official baseline.',
      code: `await octokit.rest.checks.update({
  conclusion: passed ? 'success' : 'failure',
  output: { title: 'DeployGuard Report', summary }
});

// Only update baseline if merged to main and passed
if (isMainBranch && passed) {
  await upsertBaseline(...);
}`
    }
  ];

  useEffect(() => {
    // Auto-advance timeline for visual effect
    const interval = setInterval(() => {
      setActiveStep((s) => (s + 1) % steps.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <div className="fade-in" style={{ paddingBottom: '4rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '4rem', marginTop: '2rem' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: '1rem' }}>
          How <span style={{ color: 'var(--accent)' }}>DeployGuard</span> Works
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto', lineHeight: 1.6 }}>
          A transparent look at the event-driven architecture, database queries, and conditional logic powering the performance engine.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
        {steps.map((step, idx) => {
          const isActive = idx === activeStep;
          return (
            <div 
              key={idx}
              onClick={() => setActiveStep(idx)}
              style={{
                background: 'var(--bg-card)',
                border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: '12px',
                padding: '1.5rem',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                transform: isActive ? 'translateY(-4px)' : 'none',
                boxShadow: isActive ? '0 8px 30px rgba(59, 130, 246, 0.15)' : 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ 
                  width: '40px', height: '40px', borderRadius: '50%', 
                  background: isActive ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.2rem', border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)'
                }}>
                  {step.icon}
                </div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Step {idx + 1}: {step.title}
                </h3>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '1.5rem' }}>
                {step.desc}
              </p>
              
              <div style={{ 
                background: '#0d1117', 
                borderRadius: '8px', 
                padding: '1rem',
                border: '1px solid #30363d',
                overflowX: 'auto',
                opacity: isActive ? 1 : 0.7,
                transition: 'opacity 0.3s ease'
              }}>
                <pre style={{ margin: 0, fontSize: '0.8rem', color: '#c9d1d9', fontFamily: 'monospace' }}>
                  <code>{step.code}</code>
                </pre>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
}
