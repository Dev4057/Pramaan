// backend/src/services/ActuarialScoring.js
// ═══════════════════════════════════════════════════════════════════
// PRAMAAN RaaS — Actuarial Scoring Engine
// Supports single-provider and multi-provider composite scoring.
// ═══════════════════════════════════════════════════════════════════

const { getProviderById, getActiveProviders } = require('../config/providers');

/**
 * Legacy single-provider score (GitHub contributions only).
 * Kept for backward compatibility with existing routes.
 *
 * @param {number} contributionsCount
 * @returns {number} 0-100
 */
function calculateDeveloperScore(contributionsCount) {
    if (typeof contributionsCount !== 'number' || isNaN(contributionsCount)) return 0;
    const provider = getProviderById('github');
    if (provider) return provider.scoreMetric(contributionsCount);
    // Inline fallback if registry isn't loaded
    if (contributionsCount >= 1000) return 95;
    if (contributionsCount >= 500) return 80;
    if (contributionsCount >= 250) return 60;
    if (contributionsCount >= 100) return 40;
    if (contributionsCount > 0) return 20;
    return 0;
}

/**
 * Multi-provider composite scoring engine.
 * Takes a map of verified proofs and produces a weighted composite score
 * with a full breakdown suitable for display.
 *
 * @param {Object} verifiedProofs - Map of providerKey → { metric, rawValue }
 *   Example: { github: { metric: 422 }, uber: { metric: { rating: 4.8, trips: 1200 } } }
 * @param {boolean} [identityVerified=false] - Whether Anon Aadhaar identity is verified
 * @returns {{ compositeScore: number, breakdown: Array, sourcesVerified: number, tier: string }}
 */
function calculateCompositeScore(verifiedProofs, identityVerified = false) {
    const breakdown = [];
    let totalWeight = 0;
    let weightedSum = 0;
    const activeProviders = getActiveProviders();

    for (const [providerKey, proofData] of Object.entries(verifiedProofs)) {
        const provider = activeProviders[providerKey];
        if (!provider) continue;

        const metric = proofData.metric;
        const providerScore = provider.scoreMetric(metric);

        breakdown.push({
            provider: providerKey,
            name: provider.shortName,
            category: provider.category,
            icon: provider.icon,
            rawMetric: metric,
            metricLabel: provider.metricLabel,
            metricUnit: provider.metricUnit,
            score: providerScore,
            weight: provider.weight,
            weightedContribution: Math.round(providerScore * provider.weight)
        });

        weightedSum += providerScore * provider.weight;
        totalWeight += provider.weight;
    }

    // Normalize if we don't have all providers (so score still reaches 100)
    let baseScore = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

    // Identity verification bonus (+5 points, capped at 100)
    const identityBonus = identityVerified ? 5 : 0;

    // Multi-source diversity bonus: reward users who verify more platforms
    const sourcesVerified = breakdown.length;
    let diversityBonus = 0;
    if (sourcesVerified >= 4) diversityBonus = 10;
    else if (sourcesVerified >= 3) diversityBonus = 7;
    else if (sourcesVerified >= 2) diversityBonus = 4;

    const compositeScore = Math.min(Math.max(baseScore + identityBonus + diversityBonus, 0), 100);

    const tier =
        compositeScore >= 90 ? 'Exceptional' :
        compositeScore >= 75 ? 'Strong' :
        compositeScore >= 55 ? 'Moderate' :
        compositeScore >= 30 ? 'Developing' : 'Early-Stage';

    return {
        compositeScore,
        baseScore,
        identityBonus,
        diversityBonus,
        sourcesVerified,
        totalPossibleSources: Object.keys(activeProviders).length,
        tier,
        breakdown
    };
}

/**
 * Convenience: score a single provider's raw metric.
 * Used when processing individual Reclaim callbacks.
 *
 * @param {string} providerKey - e.g. 'github', 'uber', 'sbi'
 * @param {*} rawMetric - The extracted metric value
 * @returns {number} 0-100
 */
function scoreProvider(providerKey, rawMetric) {
    const provider = getProviderById(providerKey);
    if (!provider) return 0;
    return provider.scoreMetric(rawMetric);
}

/**
 * Extract the key metric from merged Reclaim proof parameters.
 *
 * @param {string} providerKey
 * @param {Object} mergedParams - The merged parameter object from the proof
 * @returns {*} The extracted metric (number, object, etc.)
 */
function extractProviderMetric(providerKey, mergedParams) {
    const provider = getProviderById(providerKey);
    if (!provider) return 0;
    return provider.extractMetric(mergedParams);
}

module.exports = {
    calculateDeveloperScore,
    calculateCompositeScore,
    scoreProvider,
    extractProviderMetric
};
