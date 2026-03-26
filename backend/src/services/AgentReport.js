// backend/src/services/AgentReport.js
const axios = require('axios');

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

/**
 * Calls the local Ollama LLM to generate a risk narrative.
 */
async function executeOllama(prompt) {
  const response = await axios.post(`${OLLAMA_URL}/api/generate`, {
    model: OLLAMA_MODEL,
    prompt,
    stream: false
  }, { timeout: 45000 });
  return response.data?.response?.trim() || null;
}

/**
 * Generates a comprehensive, data-driven credit risk report.
 * Uses full multi-provider breakdown when available; falls back to legacy single-provider.
 *
 * @param {Object} profileData - Full worker profile data
 * @param {number} profileData.compositeScore - Final composite score (0-100)
 * @param {string} profileData.tier - Tier classification
 * @param {boolean} profileData.identityVerified - Aadhaar ZK verification status
 * @param {number} profileData.sourcesVerified - Number of verified sources
 * @param {number} profileData.totalSources - Total available sources
 * @param {Array} profileData.breakdown - Per-provider breakdown array
 * @param {number} [profileData.identityBonus] - Identity bonus points
 * @param {number} [profileData.diversityBonus] - Diversity bonus points
 * @param {number} [profileData.baseScore] - Base weighted score before bonuses
 * @returns {Promise<string>} Professional credit risk analysis
 */
async function generateRiskReport(profileData) {
  // Support legacy call signature: generateRiskReport(score, contributions)
  if (typeof profileData === 'number') {
    const score = profileData;
    const contributions = arguments[1] || 0;
    profileData = {
      compositeScore: score,
      tier: score >= 90 ? 'Exceptional' : score >= 75 ? 'Strong' : score >= 55 ? 'Moderate' : score >= 30 ? 'Developing' : 'Early-Stage',
      identityVerified: false,
      sourcesVerified: 1,
      totalSources: 8,
      breakdown: [{
        provider: 'github', name: 'GitHub', category: 'developer',
        rawMetric: contributions, metricLabel: 'contributions', score: score,
        weight: 0.20
      }]
    };
  }

  const {
    compositeScore = 0, tier = 'Unknown', identityVerified = false,
    sourcesVerified = 0, totalSources = 8, breakdown = [],
    identityBonus = 0, diversityBonus = 0, baseScore = compositeScore
  } = profileData;

  // Build structured data summary for the AI
  const providerLines = breakdown.map(p => {
    let metricStr = '';
    if (typeof p.rawMetric === 'object' && p.rawMetric !== null) {
      if (p.rawMetric.rating !== undefined) metricStr = `${p.rawMetric.rating}★ rating, ${p.rawMetric.trips || 0} trips`;
      else if (p.rawMetric.balance !== undefined) metricStr = `₹${(p.rawMetric.balance || 0).toLocaleString()} balance, ₹${(p.rawMetric.monthlyIncome || 0).toLocaleString()}/mo income`;
      else if (p.rawMetric.type === 'followers') metricStr = `${p.rawMetric.value.toLocaleString()} followers`;
      else if (p.rawMetric.type === 'watch_count') metricStr = `${p.rawMetric.value} titles watched`;
      else if (p.rawMetric.type === 'servers') metricStr = `${p.rawMetric.value} servers`;
      else if (p.rawMetric.type === 'order_count') metricStr = `${p.rawMetric.value} orders`;
      else if (p.rawMetric.type === 'connections') metricStr = `${p.rawMetric.value} connections`;
      else if (p.rawMetric.type === 'profile_verified') metricStr = 'profile verified';
      else metricStr = JSON.stringify(p.rawMetric);
    } else {
      metricStr = `${p.rawMetric} ${p.metricLabel || ''}`.trim();
    }
    return `  - ${p.name} (${p.category}): Score ${p.score}/100, Weight ${Math.round((p.weight || 0) * 100)}%, Metric: ${metricStr}`;
  }).join('\n');

  const categoryMap = {};
  breakdown.forEach(p => {
    if (!categoryMap[p.category]) categoryMap[p.category] = [];
    categoryMap[p.category].push(p.name);
  });
  const categoryStr = Object.entries(categoryMap).map(([cat, names]) => `${cat}: ${names.join(', ')}`).join('; ');

  const prompt = `You are a senior credit risk analyst at a decentralized finance bureau. You must write a professional credit assessment report based ONLY on the verified data below. Do NOT invent any numbers or metrics — use ONLY what is provided.

=== VERIFIED WORKER PROFILE ===
Composite Score: ${compositeScore}/100
Tier: ${tier}
Identity Verified (Aadhaar ZK Proof): ${identityVerified ? 'Yes' : 'No'}
Sources Verified: ${sourcesVerified} out of ${totalSources} available
Base Weighted Score: ${baseScore}
Identity Bonus: +${identityBonus} points
Diversity Bonus: +${diversityBonus} points (for ${sourcesVerified} verified sources)

=== PROVIDER BREAKDOWN ===
${providerLines || '  No individual provider data available.'}

=== CATEGORY COVERAGE ===
${categoryStr || 'None'}

=== INSTRUCTIONS ===
Write a 3-paragraph professional credit risk assessment (200-300 words total):

Paragraph 1 — PROFILE OVERVIEW: Summarize the worker's overall creditworthiness. Reference the exact composite score, tier, and number of verified sources. Mention whether identity was verified via ZK proof.

Paragraph 2 — DATA ANALYSIS: Analyze EACH verified provider individually. For each, reference the specific metric and what it indicates about the worker's reliability, income stability, or professional engagement. Identify strengths and weaknesses. If a gig platform shows high ratings, explain what that signals. If financial data shows income levels, contextualize it. Cross-reference across providers to identify patterns.

Paragraph 3 — RISK RECOMMENDATION: Based on the data, provide a clear lending recommendation. Specify what loan terms are appropriate for this tier. Mention what additional verifications (if any) would strengthen the profile. If the worker has few sources verified, note the data coverage gap.

CRITICAL RULES:
- Reference ONLY the exact numbers provided above. Do not hallucinate or infer data not present.
- Be specific — say "4.8-star Uber rating across 2,500 trips" not "good platform ratings"
- Write as a financial analyst, not a marketer. Be balanced and objective.
- If identity is not verified, flag this as a significant risk factor.`;

  try {
    const report = await executeOllama(prompt);
    if (report) return report;
  } catch (err) {
    // Ollama not running — use deterministic fallback
  }

  // ── Deterministic fallback (no LLM required) ──
  return buildDeterministicReport(profileData);
}

/**
 * Builds a structured, data-driven report without an LLM.
 * Uses real provider data to generate meaningful analysis.
 */
function buildDeterministicReport({
  compositeScore = 0, tier = 'Unknown', identityVerified = false,
  sourcesVerified = 0, totalSources = 8, breakdown = [],
  identityBonus = 0, diversityBonus = 0, baseScore = compositeScore
}) {
  const sections = [];

  // Paragraph 1: Profile Overview
  const identityStr = identityVerified
    ? 'Identity has been cryptographically verified via Anon Aadhaar zero-knowledge proof, confirming the worker holds a valid government-issued ID without exposing any personal information.'
    : 'IMPORTANT: Identity has NOT been verified. This represents a significant gap in the risk profile and should be weighted accordingly in lending decisions.';

  sections.push(
    `[${tier} Profile — Composite Score: ${compositeScore}/100] ` +
    `This worker has verified ${sourcesVerified} out of ${totalSources} available reputation sources, ` +
    `achieving a base weighted score of ${baseScore} with ${identityBonus > 0 ? `+${identityBonus} identity bonus and ` : ''}` +
    `${diversityBonus > 0 ? `+${diversityBonus} multi-source diversity bonus` : 'no diversity bonus (fewer than 2 sources)'}. ` +
    identityStr
  );

  // Paragraph 2: Per-provider analysis
  if (breakdown.length > 0) {
    const analyses = breakdown.map(p => {
      const metric = p.rawMetric;
      let analysis = `${p.name} (${p.category}, ${Math.round((p.weight || 0) * 100)}% weight): Score ${p.score}/100. `;

      if (p.provider === 'github' || p.provider === 'developer') {
        const count = typeof metric === 'number' ? metric : metric?.value || 0;
        analysis += count >= 500 ? `${count} contributions/year indicates a highly active developer with strong technical engagement and project consistency.`
          : count >= 100 ? `${count} contributions/year shows regular development activity and reasonable technical engagement.`
          : `${count} contributions/year suggests limited or early-stage development activity.`;
      } else if (p.provider === 'uber') {
        const rating = metric?.rating || 0;
        const trips = metric?.trips || 0;
        analysis += rating >= 4.5 ? `${rating}★ rating across ${trips.toLocaleString()} completed trips demonstrates exceptional service reliability and consistent income generation.`
          : `${rating}★ rating with ${trips.toLocaleString()} trips indicates ${trips >= 500 ? 'moderate' : 'early-stage'} gig economy activity.`;
      } else if (p.provider === 'sbi') {
        const balance = metric?.balance || 0;
        const income = metric?.monthlyIncome || 0;
        const primary = income > 0 ? `monthly income of ₹${income.toLocaleString()}` : `account balance of ₹${balance.toLocaleString()}`;
        analysis += `Verified ${primary}. ${(income || balance) >= 50000 ? 'This demonstrates solid financial stability and regular cash flow.' : 'This indicates modest but present financial activity.'}`;
      } else if (p.provider === 'linkedin') {
        const val = typeof metric === 'object' ? metric.value || 0 : metric || 0;
        const mtype = typeof metric === 'object' ? metric.type : 'connections';
        analysis += mtype === 'profile_verified' ? 'Professional profile verified, confirming legitimate professional identity and career presence.'
          : `${val} connections demonstrates ${val >= 200 ? 'a well-established' : 'an emerging'} professional network.`;
      } else if (p.provider === 'twitter') {
        const val = metric?.value || 0;
        analysis += metric?.type === 'followers' ? `${val.toLocaleString()} followers indicates ${val >= 1000 ? 'meaningful social influence and public credibility' : 'an active social presence'}.`
          : 'Twitter profile verified, confirming active social media presence.';
      } else if (p.provider === 'netflix') {
        const val = metric?.value || 0;
        analysis += metric?.type === 'watch_count' ? `${val} titles watched confirms an active subscription, indicating consistent discretionary spending and financial stability.`
          : 'Active Netflix subscription verified, indicating regular spending on entertainment services.';
      } else if (p.provider === 'discord') {
        const val = metric?.value || 0;
        analysis += metric?.type === 'servers' ? `Member of ${val} servers, indicating ${val >= 10 ? 'active community engagement across multiple groups' : 'basic community participation'}.`
          : 'Discord account verified, confirming community engagement.';
      } else if (p.provider === 'amazon') {
        const val = metric?.value || 0;
        analysis += metric?.type === 'order_count' ? `${val} orders placed, demonstrating ${val >= 20 ? 'consistent purchasing activity and reliable transaction history' : 'active e-commerce usage'}.`
          : metric?.type === 'total_spend' ? `Total spend of ₹${val.toLocaleString()}, indicating ${val >= 20000 ? 'significant' : 'moderate'} purchasing power.`
          : 'Amazon account verified with order history access.';
      } else {
        analysis += `Provider score of ${p.score}/100 based on verified metrics.`;
      }
      return analysis;
    });
    sections.push('Provider-Level Analysis: ' + analyses.join(' '));
  } else {
    sections.push('No individual provider data is available for detailed analysis. The composite score is based on on-chain records only.');
  }

  // Paragraph 3: Recommendation
  let recommendation;
  if (compositeScore >= 90) {
    recommendation = `RECOMMENDATION: Exceptional profile. This worker qualifies for premium lending terms including higher loan amounts, lower interest rates, and extended repayment periods. The ${sourcesVerified}-source verification provides strong data coverage. Risk classification: LOW.`;
  } else if (compositeScore >= 75) {
    recommendation = `RECOMMENDATION: Strong profile suitable for standard DeFi micro-loans and protocol grants at competitive terms. The ${sourcesVerified} verified sources provide adequate data coverage.${sourcesVerified < 4 ? ` Verifying additional sources (${totalSources - sourcesVerified} remaining) would strengthen the profile further.` : ''} Risk classification: LOW-MODERATE.`;
  } else if (compositeScore >= 55) {
    recommendation = `RECOMMENDATION: Moderate profile. Eligible for standard loans with moderate interest rates. ${sourcesVerified < 3 ? `Data coverage is limited at ${sourcesVerified} source${sourcesVerified > 1 ? 's' : ''}; requiring additional verification would reduce risk exposure.` : `Coverage across ${sourcesVerified} sources is adequate.`}${!identityVerified ? ' Identity verification is strongly recommended before approval.' : ''} Risk classification: MODERATE.`;
  } else if (compositeScore >= 30) {
    recommendation = `RECOMMENDATION: Developing profile. Consider smaller loan tranches with collateral requirements or co-signer. Only ${sourcesVerified} of ${totalSources} sources verified — significant data gaps exist.${!identityVerified ? ' Identity is unverified, which is a major risk flag.' : ''} Risk classification: ELEVATED.`;
  } else {
    recommendation = `RECOMMENDATION: Early-stage profile with insufficient verification data. Lending is not recommended without additional verification. Only ${sourcesVerified} source${sourcesVerified > 1 ? 's' : ''} verified with a score of ${compositeScore}.${!identityVerified ? ' No identity verification present.' : ''} Risk classification: HIGH.`;
  }
  sections.push(recommendation);

  return sections.join('\n\n');
}

module.exports = { generateRiskReport };
