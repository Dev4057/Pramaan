// backend/src/services/AgentReport.js

/**
 * Generates a human-readable risk report based on the PRE-CALCULATED score.
 * @param {number} deterministicScore - The integer from ActuarialScoring.js
 * @param {number} contributionsCount - The Reclaim data (GitHub contributions)
 * @returns {string} The LLM generated report
 */
async function generateRiskReport(deterministicScore, contributionsCount) {
    const prompt = `
You are an expert Web3 Credit & Reputation Risk Analyst. 
Our deterministic actuarial engine has assigned this developer a strict reputation score of ${deterministicScore}/100.
The user has cryptographically proven via zero-knowledge proofs that they have ${contributionsCount} GitHub contributions over the last year.
Write a concise, highly professional 2-paragraph risk summary justifying why a score of ${deterministicScore} makes them a reliable candidate for a DeFi micro-loan, bounties, or protocol grants. Focus on consistency of commits as an indicator of reliability. Do NOT calculate new numbers.`;

    // Agent executes the prompt via Ollama/Local LLM here...
    // const reportText = await executeOllama(prompt);
    // return reportText;
    return `Risk Report for Score ${deterministicScore}`;
}

module.exports = { generateRiskReport };
