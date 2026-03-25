// backend/src/services/AgentReport.js
const axios = require('axios');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

/**
 * Calls the local Ollama LLM to generate a risk narrative.
 * @param {string} prompt
 * @returns {Promise<string>}
 */
async function executeOllama(prompt) {
  const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
    model: OLLAMA_MODEL,
    prompt,
    stream: false
  }, { timeout: 30000 });

  return response.data?.response?.trim() || null;
}

/**
 * Generates a human-readable risk report based on the PRE-CALCULATED score.
 * Tries Ollama first; falls back to a deterministic template if Ollama is unavailable.
 *
 * @param {number} deterministicScore - The integer from ActuarialScoring.js (0-100)
 * @param {number} contributionsCount - GitHub contributions proven via Reclaim ZK proof
 * @returns {Promise<string>} Risk narrative
 */
async function generateRiskReport(deterministicScore, contributionsCount) {
  const prompt = `You are an expert Web3 Credit & Reputation Risk Analyst.
Our deterministic actuarial engine has assigned this developer a reputation score of ${deterministicScore}/100.
The user has cryptographically proven via zero-knowledge proofs that they have ${contributionsCount} GitHub contributions over the last year.
Write a concise, professional 2-paragraph risk summary explaining why a score of ${deterministicScore} makes them a suitable or unsuitable candidate for a DeFi micro-loan or protocol grant. Focus on commit consistency as a reliability signal. Do NOT invent new numbers.`;

  try {
    const report = await executeOllama(prompt);
    if (report) return report;
  } catch (err) {
    // Ollama not running or timed out — use deterministic fallback below
  }

  // Deterministic fallback (no LLM required)
  const tier =
    deterministicScore >= 95 ? 'Exceptional' :
    deterministicScore >= 80 ? 'Strong' :
    deterministicScore >= 60 ? 'Moderate' :
    deterministicScore >= 40 ? 'Developing' : 'Early-Stage';

  return `[${tier} Profile — Score ${deterministicScore}/100] This developer has demonstrated ${contributionsCount} cryptographically verified GitHub contributions over the past year, placing them in the ${tier.toLowerCase()} tier of the Pramaan reputation model. Consistent contribution activity is a strong proxy for reliability, technical engagement, and project follow-through — key indicators for micro-loan underwriting.\n\nBased on the actuarial model, a score of ${deterministicScore} indicates ${deterministicScore >= 60 ? 'a credible track record suitable for DeFi micro-loans and protocol grants at standard risk parameters' : 'an emerging profile that may qualify for smaller loan tranches with appropriate collateral or co-signer requirements'}. Identity and income data are verified via ZK proofs; no raw personal data was exposed during this assessment.`;
}

module.exports = { generateRiskReport };
