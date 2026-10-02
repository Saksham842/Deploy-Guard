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
    <div className="relative bg-[#0E1118]/85 backdrop-blur-xl border border-white/[0.08] rounded-xl p-6 overflow-hidden shadow-xl">
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-violet-500 via-indigo-500 to-cyan-400" />
      <div className="flex justify-between items-center mb-5">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2.5">
            <span>AI Health & Regression Diagnostics</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-violet-300">
              Groq LLaMA 3.1
            </span>
          </h2>
          <p className="text-xs text-[#9CA3AF] mt-0.5">
            Automated intelligence across commit patterns, bundle chunk shifts, and recurrence trends
          </p>
        </div>
      </div>

      {!report && !loading && (
        <div className="text-center py-10 border border-dashed border-white/[0.1] rounded-xl bg-white/[0.01]">
          <div className="text-2xl mb-2">⚡</div>
          <p className="text-[#9CA3AF] text-xs mb-4 max-w-sm mx-auto">
            Execute an on-demand audit to evaluate performance health and detect recurring regression patterns.
          </p>
          <GsapMagnetic strength={0.3}>
            <button
              onClick={handleGenerate}
              className="btn btn-primary text-xs shadow-lg hover:shadow-[0_0_25px_rgba(124,58,237,0.5)] cursor-pointer"
            >
              Run Health Audit
            </button>
          </GsapMagnetic>
        </div>
      )}

      {loading && (
        <div className="space-y-3 py-3">
          <div className="skeleton h-4 w-3/4" />
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-5/6" />
          <div className="skeleton h-20 w-full" />
        </div>
      )}

      {report && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-5"
        >
          {/* Trend Warning Banner */}
          {trendWarning?.detected && (
            <div className="bg-amber-950/30 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3 shadow-[0_0_20px_rgba(245,158,11,0.12)]">
              <span className="text-base leading-none mt-0.5">⚠️</span>
              <div>
                <div className="text-xs font-bold text-amber-300">
                  Recurring Regression Pattern Detected
                </div>
                <div className="text-xs text-[#E5E7EB] mt-1 leading-relaxed">
                  <code className="bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-mono text-[11px]">
                    {trendWarning.cause_type}
                  </code>{' '}
                  accounted for regressions in <strong className="text-white font-mono">{trendWarning.count}</strong> recent failing runs.
                </div>
              </div>
            </div>
          )}

          {/* Visual Chunk Diff Breakdown (Recharts Horizontal BarChart) */}
          {chartData.length > 0 && (
            <div className="bg-[#08090C]/90 border border-white/[0.08] rounded-xl p-4 shadow-inner">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#9CA3AF] flex items-center gap-2">
                  <span>📊</span>
                  <span>Top Chunk Size Shifts (Latest PR Δ)</span>
                </span>
                <span className="text-[11px] font-mono text-cyan-300 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/30">KB delta</span>
              </div>
              <ResponsiveContainer width="100%" height={chartData.length * 36 + 20}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ top: 0, right: 30, left: 10, bottom: 0 }}
                >
                  <XAxis
                    type="number"
                    tick={{ fill: '#9CA3AF', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tick={{ fill: '#F3F4F6', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                    axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
                    tickLine={false}
                    width={160}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const item = payload[0].payload;
                      const isGrew = item.deltaKb > 0;
                      return (
                        <div className="bg-[#0E1118]/95 backdrop-blur-xl border border-white/[0.12] p-3 rounded-xl shadow-2xl text-xs font-mono">
                          <div className="text-white font-bold mb-1">{item.fullName}</div>
                          <div className={isGrew ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                            Δ: {isGrew ? '+' : ''}{item.deltaKb} KB
                          </div>
                          <div className="text-[#9CA3AF] text-[10px] mt-0.5">
                            {item.beforeKb} KB → {item.afterKb} KB
                          </div>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="deltaKb" barSize={14} radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.deltaKb > 0 ? '#F43F5E' : '#10B981'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Differentiated Strengths / Risks / Recommendations sections */}
          {sections ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {/* Strengths */}
              <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-xl p-4 shadow-[0_0_20px_rgba(16,185,129,0.08)]">
                <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 mb-2">
                  <span>✅</span>
                  <span>Strengths</span>
                </div>
                <div className="text-xs text-[#E5E7EB] leading-relaxed whitespace-pre-wrap font-sans space-y-1">
                  {sections.strengths}
                </div>
              </div>

              {/* Risks */}
              <div className="bg-rose-950/20 border border-rose-500/30 rounded-xl p-4 shadow-[0_0_20px_rgba(244,63,94,0.08)]">
                <div className="text-xs font-bold text-rose-400 flex items-center gap-1.5 mb-2">
                  <span>⚠️</span>
                  <span>Risks</span>
                </div>
                <div className="text-xs text-[#E5E7EB] leading-relaxed whitespace-pre-wrap font-sans space-y-1">
                  {sections.risks}
                </div>
              </div>

              {/* Recommendations */}
              <div className="bg-violet-950/20 border border-violet-500/30 rounded-xl p-4 shadow-[0_0_20px_rgba(124,58,237,0.08)]">
                <div className="text-xs font-bold text-violet-300 flex items-center gap-1.5 mb-2">
                  <span>🔧</span>
                  <span>Recommendations</span>
                </div>
                <div className="text-xs text-[#E5E7EB] leading-relaxed whitespace-pre-wrap font-sans space-y-1">
                  {sections.recommendations}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#08090C] border border-white/[0.08] rounded-xl p-4">
              <pre className="text-xs text-[#E5E7EB] leading-relaxed whitespace-pre-wrap font-mono">
                {report}
              </pre>
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <GsapMagnetic strength={0.2}>
              <button
                onClick={handleGenerate}
                className="btn btn-ghost text-xs hover:border-violet-500/40"
                disabled={loading}
              >
                Regenerate Audit
              </button>
            </GsapMagnetic>
          </div>
        </motion.div>
      )}
    </div>
  );
}
