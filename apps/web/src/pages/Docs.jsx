import { useEffect, useState } from 'react';

export default function Docs() {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      title: 'Webhook Triggered',
      icon: '🔔',
      desc: 'GitHub sends a pull_request.opened event. The Express backend securely verifies the HMAC-SHA256 signature before processing anything.',
      code: `app.webhooks.on('pull_request.opened', handlePR);
app.webhooks.on('pull_request.synchronize', handlePR);

// Cryptographic webhook verification
const signature = req.headers['x-hub-signature-256'];
verify(secret, rawBody, signature); // rejects if tampered`
    },
    {
      title: 'Fetch Performance Baseline',
      icon: '📊',
      desc: 'DeployGuard queries PostgreSQL to find the last known-good performance baseline for the target branch. Baselines are only updated on successful merges to main.',
      code: `SELECT value, updated_at
FROM baselines
WHERE repo_id = $1
  AND branch  = $2
  AND metric  = 'bundle_kb'
ORDER BY updated_at DESC
LIMIT 1;`
    },
    {
      title: 'Analyze Bundle & Diff Packages',
      icon: '⚡',
      desc: 'We fetch the new bundle size from CI artifacts and diff package.json between base→head to detect added, removed, or upgraded dependencies.',
      code: `const bundleResult = await analyseBundle(octokit, headSha);
const pkgDiff = await diffPackageJson(octokit, baseSha, headSha);

// pkgDiff shape:
// {
//   added:    ['framer-motion'],
//   removed:  [],
//   upgraded: [{ name: 'react', from: '18.2', to: '18.3' }]
// }`
    },
    {
      title: 'NLP Causation Engine (v2)',
      icon: '🧠',
      desc: 'A Python FastAPI microservice runs a 3-tier classification pipeline: semantic embeddings via sentence-transformers → Groq LLM fallback for low-confidence commits → best-guess degradation.',
      code: `# Tier 1 — Local ML (all-MiniLM-L6-v2 + LogisticRegression)
embedding = model.encode(commit_message)      # 384-dim vector
proba = classifier.predict_proba([embedding]) # 10-class scores
confidence = proba.max()

if confidence >= 0.55:
    return { "cause": label, "confidence": confidence }

# Tier 2 — Groq LLM fallback (llama-3.1-8b-instant)
if GROQ_API_KEY:
    response = groq.chat(commit_message)
    return { "cause": response.cause, "via_groq": True }

# Tier 3 — Return best ML guess with low_confidence flag
return { "cause": label, "confidence": confidence,
         "low_confidence": True }`
    },
    {
      title: 'Threshold Pass / Fail Logic',
      icon: '⚖️',
      desc: "We compare each metric delta against the repository's configurable thresholds (e.g. ±10% bundle size). All metrics must pass for the check to succeed.",
      code: `const bundleDelta = ((after - before) / before) * 100;

const metrics = [
  { key: 'bundle_kb',  delta: bundleDelta,  threshold: 10 },
  { key: 'api_p95_ms', delta: latencyDelta, threshold: 20 },
];

const passed = metrics.every(m =>
  Math.abs(m.delta) <= m.threshold
);`
    },
    {
      title: 'Update GitHub & Database',
      icon: '💾',
      desc: 'We post a native Check Run (pass/fail) and an automated PR comment. Only when a PR merges to main and passes do we promote the baseline — preventing silent regressions.',
      code: `await octokit.rest.checks.update({
  conclusion: passed ? 'success' : 'failure',
  output: { title: 'DeployGuard Report', summary }
});

await octokit.rest.issues.createComment({
  body: buildComment(metrics, causes, pkgDiff)
});

// Strict baseline integrity — only on merge + pass
if (isMainBranch && passed) {
  await upsertBaseline(repoId, branch, 'bundle_kb', newKb);
}`
    }
  ];

  const nlpTiers = [
    {
      tier: 'Tier 1',
      label: 'Local ML Model',
      color: '#3b82f6',
      glow: 'rgba(59,130,246,0.15)',
      detail: 'all-MiniLM-L6-v2 + LogisticRegression',
      badge: '< 50ms · offline · 10 classes',
      icon: '🤖',
      condition: 'confidence ≥ 0.55 → return result',
    },
    {
      tier: 'Tier 2',
      label: 'Groq LLM Fallback',
      color: '#f59e0b',
      glow: 'rgba(245,158,11,0.15)',
      detail: 'llama-3.1-8b-instant (free tier)',
      badge: '~200ms · only if GROQ_API_KEY set',
      icon: '✨',
      condition: 'if Groq unavailable → Tier 3',
    },
    {
      tier: 'Tier 3',
      label: 'Best-Guess Fallback',
      color: '#22c55e',
      glow: 'rgba(34,197,94,0.15)',
      detail: 'Returns top ML prediction',
      badge: 'low_confidence: true in response',
      icon: '🎯',
      condition: 'always succeeds — never throws',
    },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStep((s) => (s + 1) % steps.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [steps.length]);

  return (
    <div className="fade-in" style={{ paddingBottom: '5rem' }}>

      {/* ── Header ── */}
      <div style={{ textAlign: 'center', marginBottom: '4rem', marginTop: '2rem' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 800, letterSpacing: '-0.04em', marginBottom: '1rem' }}>
          How <span style={{ color: 'var(--accent)' }}>DeployGuard</span> Works
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '640px', margin: '0 auto', lineHeight: 1.7 }}>
          A transparent look at the event-driven architecture, semantic NLP pipeline,
          and baseline logic that powers every PR check.
        </p>
      </div>

      {/* ── Step cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', maxWidth: '1080px', margin: '0 auto 5rem' }}>
        {steps.map((step, idx) => {
          const isActive = idx === activeStep;
          return (
            <div
              key={idx}
              onClick={() => setActiveStep(idx)}
              style={{
                background: 'var(--bg-card)',
                border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: '14px',
                padding: '1.5rem',
                cursor: 'pointer',
                transition: 'all 0.3s ease',
                transform: isActive ? 'translateY(-4px)' : 'none',
                boxShadow: isActive ? '0 8px 30px rgba(59,130,246,0.15)' : 'none',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* step number badge */}
              <div style={{
                position: 'absolute', top: '1rem', right: '1rem',
                background: isActive ? 'rgba(59,130,246,0.12)' : 'var(--bg-primary)',
                border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: '999px', padding: '0.15rem 0.55rem',
                fontSize: '0.7rem', fontWeight: 700,
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                letterSpacing: '0.04em',
              }}>
                {idx + 1} / {steps.length}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', marginBottom: '1rem' }}>
                <div style={{
                  width: '42px', height: '42px', borderRadius: '10px',
                  background: isActive ? 'rgba(59,130,246,0.1)' : 'var(--bg-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.25rem',
                  border: isActive ? '1px solid var(--accent)' : '1px solid var(--border)',
                  flexShrink: 0,
                }}>
                  {step.icon}
                </div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                  {step.title}
                </h3>
              </div>

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', lineHeight: 1.65, marginBottom: '1.25rem' }}>
                {step.desc}
              </p>

              <div style={{
                background: '#0d1117',
                borderRadius: '8px',
                padding: '0.875rem 1rem',
                border: '1px solid #21262d',
                overflowX: 'auto',
                opacity: isActive ? 1 : 0.65,
                transition: 'opacity 0.3s ease',
              }}>
                <pre style={{ margin: 0, fontSize: '0.75rem', color: '#c9d1d9', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  <code>{step.code}</code>
                </pre>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── NLP 3-Tier Pipeline section ── */}
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: '0.5rem' }}>
            🧠 NLP 3-Tier Classification Pipeline
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', maxWidth: '560px', margin: '0 auto' }}>
            Every commit message travels through these tiers in order — escalating only when the local model isn't confident enough.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
          {nlpTiers.map((tier, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: '100%',
                background: 'var(--bg-card)',
                border: `1px solid ${tier.color}44`,
                borderRadius: '12px',
                padding: '1.25rem 1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1.25rem',
                transition: 'box-shadow 0.2s',
                boxShadow: `0 0 0 1px ${tier.color}22, 0 4px 24px ${tier.glow}`,
              }}>
                <div style={{
                  width: '48px', height: '48px', borderRadius: '12px', flexShrink: 0,
                  background: tier.glow, border: `1px solid ${tier.color}66`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem',
                }}>
                  {tier.icon}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em',
                      color: tier.color, textTransform: 'uppercase',
                      background: tier.glow, padding: '0.15rem 0.5rem', borderRadius: '999px',
                      border: `1px solid ${tier.color}44`,
                    }}>{tier.tier}</span>
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{tier.label}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{tier.detail}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: "'JetBrains Mono', monospace" }}>{tier.badge}</div>
                </div>

                <div style={{
                  fontSize: '0.75rem', color: tier.color,
                  background: tier.glow, border: `1px solid ${tier.color}33`,
                  borderRadius: '8px', padding: '0.375rem 0.75rem',
                  fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
                  maxWidth: '200px', textAlign: 'center', lineHeight: 1.4,
                }}>
                  {tier.condition}
                </div>
              </div>

              {/* connector arrow */}
              {i < nlpTiers.length - 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.25rem 0', gap: '2px' }}>
                  <div style={{ width: '2px', height: '12px', background: 'var(--border)' }} />
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.04em' }}>low confidence</div>
                  <div style={{ width: '2px', height: '12px', background: 'var(--border)' }} />
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>▼</div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* model output example */}
        <div style={{
          marginTop: '2rem',
          background: '#0d1117', borderRadius: '12px',
          border: '1px solid #21262d', padding: '1.25rem 1.5rem',
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            📦 Example classifier response (v2)
          </div>
          <pre style={{ margin: 0, fontSize: '0.8rem', color: '#c9d1d9', fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.8 }}>
            <code>{`{
  "cause":         "bundle_size",
  "confidence":    0.94,
  "model_version": "v2-sentence-transformers",
  "via_groq":      false,
  "all_scores": {
    "bundle_size":       0.94,
    "query_regression":  0.03,
    "latency_spike":     0.02,
    "dependency_bloat":  0.01
  }
}`}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
