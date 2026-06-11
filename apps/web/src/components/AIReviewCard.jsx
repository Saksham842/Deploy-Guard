import { useState } from 'react';
import { api } from '../api';

export default function AIReviewCard({ repoId }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const data = await api.getAiReview(repoId.owner, repoId.name);
      setReport(data.report);
    } catch {
      setReport('AI review temporarily unavailable.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card fade-in">
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-base font-bold text-white">🤖 AI Project Health Review</h2>
      </div>

      {!report && !loading && (
        <div className="text-center py-6">
          <p className="text-slate-400 mb-4">
            Generate an AI-powered health review for this repository based on all check run data.
          </p>
          <button
            onClick={handleGenerate}
            className="btn btn-primary"
          >
            ✨ Generate AI Review
          </button>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          <div className="skeleton h-4 w-3/4" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-5/6" />
          <div className="skeleton h-4 w-2/3" />
          <div className="skeleton h-4 w-4/5" />
          <div className="skeleton h-4 w-3/5" />
        </div>
      )}

      {report && !loading && (
        <div>
          <pre className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-sans">
            {report}
          </pre>
          <button
            onClick={handleGenerate}
            className="btn btn-ghost mt-4"
            disabled={loading}
          >
            ✨ Regenerate
          </button>
        </div>
      )}
    </div>
  );
}
