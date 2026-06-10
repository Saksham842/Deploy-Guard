import { useEffect, useState } from 'react';

// Documentation / How-it-works page explaining the inner workings, NLP tiers, and webhook structure.
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

  const [popupStep, setPopupStep] = useState(null);
  const [userInteracted, setUserInteracted] = useState(false);

  useEffect(() => {
    if (userInteracted || popupStep !== null) return;

    const interval = setInterval(() => {
      setActiveStep((s) => (s + 1) % steps.length);
    }, 4500);
    return () => clearInterval(interval);
  }, [steps.length, userInteracted, popupStep]);

  const openStepDetails = (idx) => {
    setUserInteracted(true);
    setPopupStep(idx);
  };

  return (
    <>
      <div className="fade-in pb-20">
        {/* Header */}
        <div className="text-center mb-16 mt-8">
          <h1 className="text-5xl font-extrabold tracking-tight mb-4 text-white">
            How <span className="text-blue-500">DeployGuard</span> Works
          </h1>
          <p className="text-slate-300 text-lg max-w-[640px] mx-auto leading-relaxed">
            A transparent look at the event-driven architecture, semantic NLP pipeline,
            and baseline logic that powers every PR check.
          </p>
        </div>

        {/* Step cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-[1080px] mx-auto mb-20">
          {steps.map((step, idx) => {
            const isActive = idx === activeStep;
            return (
              <div
                key={idx}
                onClick={() => openStepDetails(idx)}
                className={`bg-[#0f1629]/75 rounded-2xl p-6 cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[190px] border transition-all duration-300 ${
                  isActive
                    ? 'border-blue-500 -translate-y-1 shadow-[0_8px_30px_rgba(59,130,246,0.15)]'
                    : 'border-[#1e2d4a]/80 hover:border-blue-500/50 hover:shadow-[0_8px_30px_rgba(59,130,246,0.12)]'
                } group`}
              >
                <div>
                  {/* Step counter badge */}
                  <div
                    className={`absolute top-4 right-4 border rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wider transition-colors duration-300 ${
                      isActive ? 'bg-blue-500/12 border-blue-500 text-blue-500' : 'bg-[#070b14] border-[#1e2d4a]/80 text-slate-400'
                    }`}
                  >
                    {idx + 1} / {steps.length}
                  </div>

                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg border flex-shrink-0 transition-colors duration-300 ${
                        isActive ? 'bg-blue-500/10 border-blue-500' : 'bg-[#070b14] border-[#1e2d4a]/80'
                      }`}
                    >
                      {step.icon}
                    </div>
                    <h3 className="text-base font-bold text-white leading-tight">
                      {step.title}
                    </h3>
                  </div>

                  <p className="text-slate-300 text-sm leading-relaxed mb-2">
                    {step.desc}
                  </p>
                </div>

                <div className="flex justify-end mt-4">
                  <span className="text-xs font-bold text-blue-500 inline-flex items-center gap-1 transition-all duration-200 group-hover:translate-x-1">
                    Read More <span className="text-[10px]">→</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* NLP 3-Tier Pipeline section */}
        <div className="max-w-[860px] mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-extrabold tracking-tight mb-2 text-white">
              🧠 NLP 3-Tier Classification Pipeline
            </h2>
            <p className="text-slate-300 text-sm max-w-[560px] mx-auto leading-relaxed">
              Every commit message travels through these tiers in order — escalating only when the local model isn't confident enough.
            </p>
          </div>

          <div className="flex flex-col gap-0">
            {nlpTiers.map((tier, i) => (
              <div key={i} className="flex flex-col items-center">
                <div
                  className="w-full bg-[#0f1629]/75 rounded-xl p-5 flex items-center gap-5 transition-shadow duration-200 shadow-lg border"
                  style={{
                    border: `1px solid ${tier.color}44`,
                    boxShadow: `0 0 0 1px ${tier.color}22, 0 4px 24px ${tier.glow}`,
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center text-xl border"
                    style={{
                      background: tier.glow,
                      borderColor: `${tier.color}66`,
                    }}
                  >
                    {tier.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2.5 mb-1 flex-wrap">
                      <span
                        className="text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border"
                        style={{
                          color: tier.color,
                          background: tier.glow,
                          borderColor: `${tier.color}44`,
                        }}
                      >
                        {tier.tier}
                      </span>
                      <span className="text-base font-bold text-white">{tier.label}</span>
                    </div>
                    <div className="text-xs text-slate-300 mb-1">{tier.detail}</div>
                    <div className="text-xs text-slate-500 font-mono">{tier.badge}</div>
                  </div>

                  <div
                    className="text-xs font-semibold whitespace-nowrap flex-shrink-0 max-w-[200px] text-center leading-relaxed border rounded-lg px-3 py-1.5"
                    style={{
                      color: tier.color,
                      background: tier.glow,
                      borderColor: `${tier.color}33`,
                    }}
                  >
                    {tier.condition}
                  </div>
                </div>

                {/* Connector Arrow */}
                {i < nlpTiers.length - 1 && (
                  <div className="flex flex-col items-center py-1 gap-0.5">
                    <div className="w-[2px] h-3 bg-[#1e2d4a]/80" />
                    <div className="text-[10px] text-slate-500 font-semibold tracking-wider">low confidence</div>
                    <div className="w-[2px] h-3 bg-[#1e2d4a]/80" />
                    <div className="text-sm text-slate-500">▼</div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Model Output Example */}
          <div className="mt-8 bg-[#0d1117] rounded-xl border border-[#21262d] p-5">
            <div className="text-xs text-slate-500 font-semibold tracking-widest uppercase mb-3">
              📦 Example classifier response (v2)
            </div>
            <pre className="m-0 text-xs text-[#c9d1d9] font-mono leading-relaxed">
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

      {/* Pop-up Modal */}
      {popupStep !== null && (() => {
        const step = steps[popupStep];
        return (
          <div
            className="fixed inset-0 z-[999] flex items-center justify-center bg-[#070b14]/85 backdrop-blur-md p-6 animate-[fadeIn_0.25s_ease-out_forwards]"
            onClick={() => setPopupStep(null)}
          >
            <div
              className="bg-[#0f1629] border border-[#1e2d4a]/85 rounded-3xl p-10 max-w-[800px] w-full max-h-[90vh] overflow-y-auto shadow-2xl relative animate-[scaleIn_0.3s_cubic-bezier(0.34,1.56,0.64,1)_forwards]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setPopupStep(null)}
                className="absolute top-5 right-5 bg-white/5 border border-[#1e2d4a]/80 rounded-full w-9 h-9 flex items-center justify-center text-slate-300 text-base cursor-pointer transition-all hover:bg-red-500/10 hover:border-red-500/35 hover:text-red-500 hover:rotate-90"
              >
                ✕
              </button>

              {/* Step counter */}
              <div className="inline-flex bg-blue-500/12 border border-blue-500 rounded-full px-3 py-1 text-xs font-bold text-blue-500 tracking-widest mb-6 uppercase">
                Step {popupStep + 1} of {steps.length}
              </div>

              {/* Header */}
              <div className="flex items-center gap-5 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/15 border border-blue-500 flex items-center justify-center text-3xl shadow-[0_0_20px_rgba(59,130,246,0.2)]">
                  {step.icon}
                </div>
                <div>
                  <h2 className="text-3xl font-extrabold text-white m-0 tracking-tight">
                    {step.title}
                  </h2>
                </div>
              </div>

              {/* Description */}
              <p className="text-slate-300 text-base leading-relaxed mb-8">
                {step.desc}
              </p>

              {/* Code title */}
              <div className="text-xs text-slate-500 font-semibold tracking-widest uppercase mb-3 flex items-center gap-2">
                <span>🖥️</span>
                <span>Implementation Example</span>
              </div>

              {/* Code */}
              <div className="bg-[#0d1117] rounded-xl p-5 border border-[#21262d] overflow-x-auto shadow-[inset_0_2px_8px_rgba(0,0,0,0.8)]">
                <pre className="m-0 text-xs text-[#c9d1d9] font-mono leading-relaxed whitespace-pre-wrap">
                  <code>{step.code}</code>
                </pre>
              </div>

              {/* Actions */}
              <div className="flex justify-end mt-8">
                <button
                  onClick={() => setPopupStep(null)}
                  className="btn btn-primary px-7 py-2.5 text-xs rounded-xl font-bold"
                >
                  Got It
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}
