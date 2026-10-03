/**
 * DeployGuard — Groq AI Explanation Client (Node.js)
 *
 * Flow for each call:
 *   1. Try the Python NLP microservice (/explain or /summarize endpoint)
 *   2. If the microservice is unreachable / returns an error, call the
 *      Groq API directly from Node so PRs always get an AI section.
 *   3. If both fail, return null silently — never blocks the check run.
 */

const axios = require('axios');

const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL || 'http://localhost:8000';
const GROQ_API_KEY    = process.env.GROQ_API_KEY || '';
const GROQ_API_URL    = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL      = 'llama-3.1-8b-instant';

// ── Direct Groq helper (Node fallback) ────────────────────────────────────────

async function callGroqDirect(systemPrompt, userPrompt) {
  const apiKey = (process.env.GROQ_API_KEY || GROQ_API_KEY || '').trim();
  if (!apiKey) {
    console.warn('[groqExplain] Direct Groq skipped: GROQ_API_KEY is not set');
    return null;
  }

  const candidateModels = [
    process.env.GROQ_MODEL,
    'openai/gpt-oss-120b',
    'openai/gpt-oss-20b',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
  ].filter(Boolean);

  for (const model of candidateModels) {
    try {
      console.log(`[groqExplain] Calling Groq Cloud API (${model})...`);
      const { data } = await axios.post(
        GROQ_API_URL,
        {
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user',   content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens:  600,
        },
        {
          timeout: 20_000,
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );
      const text = data.choices?.[0]?.message?.content?.trim();
      if (text) return text;
    } catch (err) {
      const errDetail = err.response?.data?.error?.message || err.message;
      console.warn(`[groqExplain] Model "${model}" failed: ${errDetail}`);
      if (err.response?.status === 401) {
        // Invalid API key — don't retry other models
        return null;
      }
    }
  }

  return null;
}

// ── Prompts (mirrored from ai_features.py) ────────────────────────────────────

const EXPLAIN_SYSTEM = (
  'You are DeployGuard AI, a performance regression analyst for GitHub pull requests. ' +
  'Speak directly to the developer ("your bundle", "your commit"). ' +
  'Cover exactly three things in order: ' +
  '1. WHAT happened (the regression) ' +
  '2. WHY it likely happened (based on the data) ' +
  '3. HOW to fix it. ' +
  'Max 5 bullet points total. Use GitHub Markdown formatting. ' +
  'Never mention or invent package names not present in the data. ' +
  'End with exactly one concrete, copy-pasteable fix command or code suggestion.'
);

const SUMMARY_SYSTEM = (
  'You are DeployGuard AI, a performance regression analyst for GitHub pull requests. ' +
  'The latest check PASSED — all metrics are within thresholds. ' +
  'Write a brief, positive summary (2-3 bullet points) confirming what\'s healthy. ' +
  'Mention the actual numbers from the data. ' +
  'If the bundle decreased, congratulate the developer on the bundle size reduction and call out the removed packages. ' +
  'Keep it concise and encouraging. Use GitHub Markdown formatting.'
);

const REVIEW_SYSTEM = (
  'You are DeployGuard AI, a project health analyst. ' +
  'Structure your response STRICTLY as three sections with these exact headers: ' +
  '✅ Strengths | ⚠️ Risks | 🔧 Recommendations. ' +
  'Exactly 3 bullet points per section, no more no less. ' +
  'Every bullet point must reference at least one actual number from the ' +
  'input data — no generic advice. ' +
  'If pass rate is below 70%, flag it as critical in Risks. ' +
  'If the same package appears multiple times, call it out by name in Risks. ' +
  'If worst regression > 100 KB, treat it as a serious concern. ' +
  'Speak to the project owner directly ("your project", "your team"). ' +
  'Use GitHub Markdown formatting.'
);

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * @param {Object} opts
 * @returns {Promise<string|null>} Markdown explanation or null on failure
 */
async function getAIExplanation({
  bundleDeltaKB,
  bundleDeltaPct,
  addedPackages,
  removedPackages,
  commitMessages,
  nlpCauseLabel,
}) {
  // 1. Try the Python NLP microservice
  try {
    const { data } = await axios.post(
      `${NLP_SERVICE_URL}/explain`,
      {
        bundle_delta_kb:  bundleDeltaKB,
        bundle_delta_pct: bundleDeltaPct,
        added_packages:   addedPackages,
        removed_packages: removedPackages,
        commit_messages:  commitMessages,
        nlp_cause:        nlpCauseLabel,
      },
      { timeout: 18_000 },
    );
    if (data.explanation) return data.explanation;
  } catch (err) {
    console.warn('[groqExplain] NLP service /explain failed:', err.message, '— trying direct Groq fallback');
  }

  // 2. Direct Groq fallback
  const userPrompt =
    `Performance regression data:\n` +
    `- Bundle delta: ${bundleDeltaKB} KB (${bundleDeltaPct}%)\n` +
    `- Added packages: ${addedPackages.join(', ') || 'none'}\n` +
    `- Removed packages: ${removedPackages.join(', ') || 'none'}\n` +
    `- Commit messages: ${commitMessages.slice(0, 10).join(' | ') || 'none'}\n` +
    `- NLP cause label: ${nlpCauseLabel}\n\n` +
    `Explain this regression in plain English for the developer who made these changes.`;

  return callGroqDirect(EXPLAIN_SYSTEM, userPrompt);
}

/**
 * @param {Object} opts
 * @returns {Promise<string|null>} Short positive summary or null on failure
 */
async function getAISummary({
  bundleDeltaKB,
  bundleDeltaPct,
  addedPackages,
  removedPackages,
  commitMessages,
}) {
  // 1. Try the Python NLP microservice
  try {
    const { data } = await axios.post(
      `${NLP_SERVICE_URL}/summarize`,
      {
        bundle_delta_kb:  bundleDeltaKB,
        bundle_delta_pct: bundleDeltaPct,
        added_packages:   addedPackages,
        removed_packages: removedPackages,
        commit_messages:  commitMessages,
      },
      { timeout: 18_000 },
    );
    if (data.summary) return data.summary;
  } catch (err) {
    console.warn('[groqExplain] NLP service /summarize failed:', err.message, '— trying direct Groq fallback');
  }

  // 2. Direct Groq fallback
  const userPrompt =
    `Check passed — all metrics within thresholds:\n` +
    `- Bundle delta: ${bundleDeltaKB} KB (${bundleDeltaPct}%)\n` +
    `- Added packages: ${addedPackages.join(', ') || 'none'}\n` +
    `- Removed packages: ${removedPackages.join(', ') || 'none'}\n` +
    `- Commit messages: ${commitMessages.slice(0, 10).join(' | ') || 'none'}\n\n` +
    `Write a brief positive summary confirming all is good.`;

  return callGroqDirect(SUMMARY_SYSTEM, userPrompt);
}

/**
 * @param {Object} reviewData
 * @returns {Promise<string|null>} Structured project health review or null on failure
 */
async function getAIReview(reviewData) {
  // 1. Try NLP service
  try {
    const { data } = await axios.post(`${NLP_SERVICE_URL}/review`, reviewData, { timeout: 15_000 });
    if (data?.report) return data.report;
  } catch (err) {
    console.warn('[groqExplain] NLP service /review failed:', err.message, '— falling back to direct Groq');
  }

  // 2. Direct Groq fallback
  const passRate = reviewData.total_checks > 0
    ? Math.round((reviewData.passed_checks / reviewData.total_checks) * 100)
    : 0;
  const trendLine = reviewData.trend_warning ? `- ⚠️ Trend warning: ${reviewData.trend_warning}\n` : '';

  const userPrompt =
    `Project health data for ${reviewData.repo_name}:\n` +
    `- Total checks: ${reviewData.total_checks}\n` +
    `- Passed checks: ${reviewData.passed_checks}\n` +
    `- Failed checks: ${reviewData.failed_checks}\n` +
    `- Pass rate: ${passRate}%\n` +
    `- Average bundle size: ${reviewData.avg_bundle_kb} KB\n` +
    `- Worst regression: ${reviewData.worst_regression_kb} KB\n` +
    `- Most common cause: ${reviewData.most_common_cause}\n` +
    `- Recently added packages: ${(reviewData.recent_packages_added || []).slice(0, 20).join(', ') || 'none'}\n` +
    `${trendLine}\n` +
    `Provide a structured health review for this project.`;

  return callGroqDirect(REVIEW_SYSTEM, userPrompt);
}

module.exports = { getAIExplanation, getAISummary, getAIReview };

