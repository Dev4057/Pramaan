// backend/src/services/ActuarialScoring.js

/**
 * Deterministic math engine for calculating developer reputation.
 * Uses Reclaim GitHub contributions as the source of truth.
 *
 * @param {number} contributionsCount - The cryptographically proven GitHub contributions over the last year.
 * @returns {number} The deterministic base score out of 100.
 */
function calculateDeveloperScore(contributionsCount) {
    if (typeof contributionsCount !== 'number' || isNaN(contributionsCount)) {
        return 0; // Baseline fallback for invalid data
    }

    let score = 0;

    if (contributionsCount >= 1000) {
        score += 95;
    } else if (contributionsCount >= 500) {
        score += 80;
    } else if (contributionsCount >= 250) {
        score += 60;
    } else if (contributionsCount >= 100) {
        score += 40;
    } else if (contributionsCount > 0) {
        score += 20;
    }

    // Always ensure the score strictly stays between 0 and 100
    return Math.min(Math.max(score, 0), 100);
}

module.exports = { calculateDeveloperScore };
