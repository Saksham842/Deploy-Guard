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
  if (!GROQ_API_KEY) return null;
  try {
    const { data } = await axios.post(
      GROQ_API_URL,
      {
        model: GROQ_MODEL,
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
          Authorization: `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    );
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.error('[groqExplain] Direct Groq call failed:', err.message);
    return null;
  }
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
  'Keep it concise and encouraging. Use GitHub Markdown formatting.'
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

module.exports = { getAIExplanation, getAISummary };
