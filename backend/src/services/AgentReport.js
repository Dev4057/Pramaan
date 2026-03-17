// backend/src/services/AgentReport.js

/**
 * Generates a human-readable risk report based on the PRE-CALCULATED score.
 * @param {number} deterministicScore - The integer from ActuarialScoring.js
 * @param {Object} rawData - The Reclaim data (income, rating)
 * @returns {string} The LLM generated report
 */
async function generateRiskReport(deterministicScore, rawData) {
    const prompt = `
        You are a highly analytical Web3 Credit Risk Assessor.
        The system's actuarial engine has assigned this user a strict score of ${deterministicScore}/100.
        Their verified data is: Monthly Income: $${rawData.income}, Rating: ${rawData.rating}.
        Write a concise, professional 2-paragraph risk summary justifying why this score makes them a suitable or risky candidate for a DeFi micro-loan.
        Do NOT invent new numbers. Do NOT calculate a new score. Justify the existing score.
    `;

    // Agent executes the prompt via Ollama/Local LLM here...
    // const reportText = await executeOllama(prompt);
    // return reportText;
    return `Risk Report for Score ${deterministicScore}`;
}

module.exports = { generateRiskReport };
