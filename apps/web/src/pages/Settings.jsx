import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';

// Settings page to manage performance regression thresholds for a repository.
export default function Settings() {
  const { owner, name } = useParams();
  const [thresholds, setThresholds] = useState({ bundle_kb: 10, query_count: 20, api_p95_ms: 200 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getThresholds(owner, name)
      .then((t) => {
        setThresholds(t);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [owner, name]);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await api.updateThresholds(owner, name, thresholds);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleChange(key, value) {
    setThresholds((prev) => ({ ...prev, [key]: Number(value) }));
  }

  return (
    <div className="fade-in max-w-[560px]">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm text-slate-400">
        <Link to="/dashboard" className="text-blue-500 no-underline hover:underline">Dashboard</Link>
        <span>/</span>
        <Link to={`/repo/${owner}/${name}`} className="text-blue-500 no-underline hover:underline">{owner}/{name}</Link>
        <span>/</span>
        <span className="text-white">Settings</span>
      </div>

      <h1 className="text-2xl font-extrabold mb-1 text-white">⚙️ Threshold Settings</h1>
      <p className="text-slate-400 text-sm mb-8">
        A PR is marked as failing if any metric exceeds its threshold.
      </p>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-20" />
          ))}
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="card">
            <ThresholdField
              label="📦 Bundle Size"
              description="Maximum allowed % increase in total bundle size"
              unit="% increase"
              id="bundle_kb"
              value={thresholds.bundle_kb}
              onChange={(v) => handleChange('bundle_kb', v)}
              min={1}
              max={100}
            />
          </div>

          <div className="card">
            <ThresholdField
              label="🔢 Query Count"
              description="Maximum allowed % increase in DB query count per request"
              unit="% increase"
              id="query_count"
              value={thresholds.query_count}
              onChange={(v) => handleChange('query_count', v)}
              min={1}
              max={100}
            />
          </div>

          <div className="card !mb-8">
            <ThresholdField
              label="⚡ API p95 Latency"
              description="Maximum allowed % increase in API response time (p95)"
              unit="% increase"
              id="api_p95_ms"
              value={thresholds.api_p95_ms}
              onChange={(v) => handleChange('api_p95_ms', v)}
              min={1}
              max={200}
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-500 mb-4 text-sm">
              ⚠️ {error}
            </div>
          )}

          {saved && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-green-500 mb-4 text-sm">
              ✅ Thresholds saved — next check will use these values
            </div>
          )}

          <div className="flex gap-3">
            <button id="save-thresholds-btn" type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save thresholds'}
            </button>
            <Link to={`/repo/${owner}/${name}`} className="btn btn-ghost">Cancel</Link>
          </div>
        </form>
      )}
    </div>
  );
}

function ThresholdField({ label, description, unit, id, value, onChange, min, max }) {
  return (
    <div>
      <label htmlFor={id} className="block font-semibold mb-1 text-sm text-white">
        {label}
      </label>
      <p className="text-slate-400 text-xs mb-3">{description}</p>
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="number"
          className="input max-w-[120px]"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="text-slate-400 text-sm">{unit}</span>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 accent-blue-500"
        />
      </div>
    </div>
  );
}
