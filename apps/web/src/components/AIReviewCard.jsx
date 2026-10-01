import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../api';
import GsapMagnetic from './GsapMagnetic';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';

function parseSections(reportText) {
  if (!reportText || typeof reportText !== 'string') return null;

  const strengthsMatch = reportText.match(/✅\s*Strengths:?([\s\S]*?)(?=⚠️\s*Risks|🔧\s*Recommendations|$)/i);
  const risksMatch = reportText.match(/⚠️\s*Risks:?([\s\S]*?)(?=🔧\s*Recommendations|$)/i);
  const recsMatch = reportText.match(/🔧\s*Recommendations:?([\s\S]*?)$/i);

  if (strengthsMatch || risksMatch || recsMatch) {
    return {
      strengths: strengthsMatch ? strengthsMatch[1].trim() : '',
      risks: risksMatch ? risksMatch[1].trim() : '',
      recommendations: recsMatch ? recsMatch[1].trim() : '',
    };
  }
  return null;
}

export default function AIReviewCard({ repoId }) {
  const [report,       setReport]       = useState(null);
  const [trendWarning, setTrendWarning] = useState(null);
  const [chunkDiff,    setChunkDiff]    = useState([]);
  const [loading,      setLoading]      = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const data = await api.getAiReview(repoId.owner, repoId.name);
      setReport(data.report);
      setTrendWarning(data.trend_warning ?? null);
      setChunkDiff(data.chunk_diff ?? []);
    } catch {
      setReport('AI review temporarily unavailable.');
      setTrendWarning(null);
      setChunkDiff([]);
    } finally {
      setLoading(false);
    }
  };

  const sections = parseSections(report);

  // Prepare chart data for Recharts BarChart
  const chartData = chunkDiff.map(c => {
    const deltaKb = Math.round((c.after_bytes - c.before_bytes) / 1024 * 10) / 10;
    return {
      name: c.chunk_name.length > 22 ? `…${c.chunk_name.slice(-20)}` : c.chunk_name,
      fullName: c.chunk_name,
      deltaKb,
      beforeKb: Math.round(c.before_bytes / 1024),
      afterKb: Math.round(c.after_bytes / 1024),
    };
  });

  return (
    <div className="bg-[#161A1F] border border-[#252B32] rounded-lg p-5">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-sm font-semibold text-[#E8EAED] flex items-center gap-2">
            <span>AI Health & Regression Review</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#252B32] text-[#8B92A0]">
              LLM + Groq
            </span>
          </h2>
          <p className="text-xs text-[#8B92A0] mt-0.5">
            Automated analysis across commit patterns, bundle chunk shifts, and recurrence trends
          </p>
        </div>
      </div>

      {!report && !loading && (
        <div className="text-center py-8 border border-dashed border-[#252B32] rounded-lg">
          <p className="text-[#8B92A0] text-xs mb-3">
            Run an on-demand audit to evaluate project performance health and recurring patterns.
          </p>
          <GsapMagnetic strength={0.3}>
            <button
              onClick={handleGenerate}
              className="btn btn-primary text-xs shadow-sm hover:shadow-[0_0_20px_rgba(76,141,255,0.25)]"
            >
              Run Health Review
            </button>
          </GsapMagnetic>
        </div>
      )}

      {loading && (
        <div className="space-y-3 py-2">
          <div className="skeleton h-4 w-3/4" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-5/6" />
          <div className="skeleton h-16 w-full" />
        </div>
      )}

      {report && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-4"
        >
          {/* Trend Warning Banner */}
          {trendWarning?.detected && (
            <div className="bg-[rgba(245,166,35,0.06)] border border-[rgba(245,166,35,0.3)] rounded-md p-3 flex items-start gap-2.5">
              <span className="text-sm leading-none mt-0.5">⚠️</span>
              <div>
                <div className="text-xs font-semibold text-[#F5A623]">
                  Recurring Regression Pattern Detected
                </div>
                <div className="text-xs text-[#E8EAED] mt-0.5">
                  <code className="bg-[rgba(245,166,35,0.15)] text-[#F5A623] px-1 py-0.5 rounded text-[11px]">
                    {trendWarning.cause_type}
                  </code>{' '}
                  accounted for regressions in <strong>{trendWarning.count}</strong> recent failing checks.
                </div>
              </div>
            </div>
          )}

          {/* Visual Chunk Diff Breakdown (Recharts Horizontal BarChart) */}
          {chartData.length > 0 && (
            <div className="bg-[#0D0F12] border border-[#252B32] rounded-md p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#8B92A0]">
                  Top Chunk Size Shifts (Latest PR Δ)
                </span>
                <span className="text-[11px] font-mono text-[#8B92A0]">KB delta</span>
              </div>
              <ResponsiveContainer width="100%" height={chartData.length * 34 + 20}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 0, right: 30, left: 10, bottom: 0 }}
                >
                  <XAxis
                    type="number"
                    tick={{ fill: '#8B92A0', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                    axisLine={{ stroke: '#252B32' }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: '#E8EAED', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                    axisLine={{ stroke: '#252B32' }}
                    tickLine={false}
                    width={150}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0].payload;
                      const isGrew = item.deltaKb > 0;
                      return (
                        <div className="bg-[#161A1F] border border-[#252B32] p-2 rounded shadow-lg text-xs font-mono">
                          <div className="text-[#E8EAED] font-semibold">{item.fullName}</div>
                          <div className={isGrew ? 'text-[#F0605A]' : 'text-[#3DD68C]'}>
                            Δ: {isGrew ? '+' : ''}{item.deltaKb} KB
                          </div>
                          <div className="text-[#8B92A0] text-[10px]">
                            {item.beforeKb} KB → {item.afterKb} KB
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="deltaKb" barSize={12} radius={[0, 3, 3, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.deltaKb > 0 ? '#F0605A' : '#3DD68C'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Differentiated Strengths / Risks / Recommendations sections */}
          {sections ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Strengths */}
              <div className="bg-[#0D0F12] border-t-2 border-t-[#3DD68C] border border-[#252B32] rounded-md p-3.5">
                <div className="text-xs font-semibold text-[#3DD68C] flex items-center gap-1.5 mb-2">
                  <span>✅</span>
                  <span>Strengths</span>
                </div>
                <div className="text-xs text-[#E8EAED] leading-relaxed whitespace-pre-wrap font-sans space-y-1">
                  {sections.strengths}
                </div>
              </div>

              {/* Risks */}
              <div className="bg-[#0D0F12] border-t-2 border-t-[#F0605A] border border-[#252B32] rounded-md p-3.5">
                <div className="text-xs font-semibold text-[#F0605A] flex items-center gap-1.5 mb-2">
                  <span>⚠️</span>
                  <span>Risks</span>
                </div>
                <div className="text-xs text-[#E8EAED] leading-relaxed whitespace-pre-wrap font-sans space-y-1">
                  {sections.risks}
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-[#0D0F12] border-t-2 border-t-[#4C8DFF] border border-[#252B32] rounded-md p-3.5">
                <div className="text-xs font-semibold text-[#4C8DFF] flex items-center gap-1.5 mb-2">
                  <span>🔧</span>
                  <span>Recommendations</span>
                </div>
                <div className="text-xs text-[#E8EAED] leading-relaxed whitespace-pre-wrap font-sans space-y-1">
                  {sections.recommendations}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#0D0F12] border border-[#252B32] rounded-md p-4">
              <pre className="text-xs text-[#E8EAED] leading-relaxed whitespace-pre-wrap font-mono">
                {report}
              </pre>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <GsapMagnetic strength={0.2}>
              <button
                onClick={handleGenerate}
                className="btn btn-ghost text-xs"
                disabled={loading}
              >
                Regenerate Review
              </button>
            </GsapMagnetic>
          </div>
        </motion.div>
      )}
    </div>
  );
}
