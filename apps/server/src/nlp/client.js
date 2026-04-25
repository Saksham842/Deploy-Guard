const axios = require('axios');

const NLP_SERVICE_URL = process.env.NLP_SERVICE_URL || 'http://localhost:8000';

/**
 * Calls the Python NLP microservice to classify commit messages.
 *
 * @param {string[]} messages   - Array of commit messages from the PR
 * @param {{ added: string[], removed: string[] }} pkgDiff - Package diff result
 * @returns {Promise<Array<{ cause_type: string, detail: string, confidence: number }>>}
 */
async function classifyCommits(messages, pkgDiff = { added: [], removed: [] }) {
  try {
    const response = await axios.post(
      `${NLP_SERVICE_URL}/classify`,
      {
        messages,
        new_packages: pkgDiff.added || [],
        removed_packages: pkgDiff.removed || [],
      },
      { timeout: 10_000 }  // 10 s timeout — NLP cold-start on free tier can be slow
    );
    return response.data;
  } catch (err) {
    // NLP failure must never block the check run — return empty causes gracefully
    console.warn('[nlp] Classification failed, proceeding without causes:', err.message);
    return [];
  }
}

module.exports = { classifyCommits };
