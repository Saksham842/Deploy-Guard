import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';

export default function Settings() {
  const { owner, name } = useParams();
  const [thresholds, setThresholds] = useState({
    bundle_kb: 10,
    query_count: 20,
    api_p95_ms: 200,
    query_tracking_enabled: false,
  });
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
    setThresholds((prev) => ({
      ...prev,
      [key]: typeof value === 'boolean' ? value : Number(value),
    }));
  }

  return (
    <div className="max-w-[580px] space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-xs font-mono text-[#8B92A0]">
        <Link to="/dashboard" className="hover:text-[#4C8DFF]">repos</Link>
        <span>/</span>
        <Link to={`/repo/${owner}/${name}`} className="hover:text-[#4C8DFF]">{owner}/{name}</Link>
        <span>/</span>
        <span className="text-[#E8EAED]">thresholds</span>
      </div>

      <div className="border-b border-[#252B32] pb-4">
        <h1 className="text-xl font-bold tracking-tight text-[#E8EAED] mb-1">
          Configure thresholds
        </h1>
        <p className="text-[#8B92A0] text-xs">
          Checks fail automatically on pull requests when performance deltas exceed these limits.
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-20 w-full" />
          ))}
        </div>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="bg-[#161A1F] border border-[#252B32] rounded-lg p-4">
            <ThresholdField
              label="Bundle Size Regression Gate"
              description="Maximum allowable % increase in total bundle size relative to base branch"
              unit="% delta"
              id="bundle_kb"
              value={thresholds.bundle_kb}
              onChange={(v) => handleChange('bundle_kb', v)}
              min={1}
              max={100}
            />
          </div>

          <div className="bg-[#161A1F] border border-[#252B32] rounded-lg p-4 space-y-3">
            <ThresholdField
              label="Database Query Count Gate"
              description="Maximum allowable % increase in database queries executed during test suites"
              unit="% delta"
              id="query_count"
              value={thresholds.query_count}
              onChange={(v) => handleChange('query_count', v)}
              min={1}
              max={100}
            />
            <div className="pt-2 border-t border-[#1B2026] flex items-center justify-between text-xs">
              <span className="text-[#8B92A0]">Enable query count tracking</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={thresholds.query_tracking_enabled === true}
                  onChange={(e) => handleChange('query_tracking_enabled', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-[#252B32] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#4C8DFF]"></div>
              </label>
            </div>
          </div>

          <div className="bg-[#161A1F] border border-[#252B32] rounded-lg p-4">
            <ThresholdField
              label="API Latency Gate (p95)"
              description="Maximum allowable % increase in 95th percentile endpoint response time"
              unit="% delta"
              id="api_p95_ms"
              value={thresholds.api_p95_ms}
              onChange={(v) => handleChange('api_p95_ms', v)}
              min={1}
              max={200}
            />
          </div>

          {error && (
            <div className="bg-[rgba(240,96,90,0.08)] border border-[rgba(240,96,90,0.3)] rounded-lg p-3 text-[#F0605A] text-xs font-mono">
              ⚠️ {error}
            </div>
          )}

          {saved && (
            <div className="bg-[rgba(61,214,140,0.08)] border border-[rgba(61,214,140,0.3)] rounded-lg p-3 text-[#3DD68C] text-xs font-mono">
              ✓ Thresholds updated — will apply to all subsequent checks
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              id="save-thresholds-btn"
              type="submit"
              className="btn btn-primary text-xs"
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save thresholds'}
            </button>
            <Link to={`/repo/${owner}/${name}`} className="btn btn-ghost text-xs">
              Cancel
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}

function ThresholdField({ label, description, unit, id, value, onChange, min, max }) {
  return (
    <div>
      <label htmlFor={id} className="block font-semibold text-xs text-[#E8EAED] mb-0.5">
        {label}
      </label>
      <p className="text-[#8B92A0] text-[11px] mb-3">{description}</p>
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="number"
          className="input max-w-[90px] font-mono text-xs"
          value={value ?? 0}
          min={min}
          max={max}
          onChange={(e) => onChange(e.target.value)}
        />
        <span className="text-[#8B92A0] text-xs font-mono">{unit}</span>
        <input
          type="range"
          min={min}
          max={max}
          value={value ?? 0}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 accent-[#4C8DFF]"
        />
      </div>
    </div>
  );
}
