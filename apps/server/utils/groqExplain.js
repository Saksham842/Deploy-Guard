/**
 * DeployGuard — Groq AI Explanation Client (Node.js)
 *
 * Calls the Python NLP microservice /explain endpoint which internally
 * uses the Groq API to generate plain-English regression explanations.
 *
 * Always fails silently — never blocks the check run or PR comment.
 */

const axios = require('axios');

const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL || 'http://localhost:8000';

/**
 * @param {Object} opts
 * @param {number} opts.bundleDeltaKB
 * @param {number} opts.bundleDeltaPct
 * @param {string[]} opts.addedPackages
 * @param {string[]} opts.removedPackages
 * @param {string[]} opts.commitMessages
 * @param {string}   opts.nlpCauseLabel
 * @returns {Promise<string|null>}  Markdown explanation or null on failure
 */
async function getAIExplanation({
  bundleDeltaKB,
  bundleDeltaPct,
  addedPackages,
  removedPackages,
  commitMessages,
  nlpCauseLabel,
}) {
  try {
    const { data } = await axios.post(
      `${NLP_SERVICE_URL}/explain`,
      {
        bundle_delta_kb:   bundleDeltaKB,
        bundle_delta_pct:  bundleDeltaPct,
        added_packages:    addedPackages,
        removed_packages:  removedPackages,
        commit_messages:   commitMessages,
        nlp_cause:         nlpCauseLabel,
      },
      { timeout: 18_000 },
    );
    return data.explanation;
  } catch (err) {
    console.error('[groqExplain] Failed to get AI explanation:', err.message);
    return null;
  }
}

/**
 * @param {Object} opts
 * @param {number} opts.bundleDeltaKB
 * @param {number} opts.bundleDeltaPct
 * @param {string[]} opts.addedPackages
 * @param {string[]} opts.removedPackages
 * @param {string[]} opts.commitMessages
 * @returns {Promise<string|null>}  Short positive summary or null on failure
 */
async function getAISummary({
  bundleDeltaKB,
  bundleDeltaPct,
  addedPackages,
  removedPackages,
  commitMessages,
}) {
  try {
    const { data } = await axios.post(
      `${NLP_SERVICE_URL}/summarize`,
      {
        bundle_delta_kb:   bundleDeltaKB,
        bundle_delta_pct:  bundleDeltaPct,
        added_packages:    addedPackages,
        removed_packages:  removedPackages,
        commit_messages:   commitMessages,
      },
      { timeout: 18_000 },
    );
    return data.summary;
  } catch (err) {
    console.error('[groqExplain] Failed to get AI summary:', err.message);
    return null;
  }
}

module.exports = { getAIExplanation, getAISummary };
