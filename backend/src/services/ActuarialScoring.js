// backend/src/services/ActuarialScoring.js

/**
 * Deterministic function to calculate GigScore based on verified Reclaim Data.
 * @param {number} monthlyIncome - Verified income in USD
 * @param {number} completedTrips - Total historical trips/gigs
 * @param {number} rating - User rating (e.g., 1.0 to 5.0)
 * @returns {number} Final Score between 0 and 100
 */
function calculateScore(monthlyIncome, completedTrips, rating) {
    let score = 0;

    // Income Weight (Max 40 points)
    if (monthlyIncome >= 1000) score += 40;
    else if (monthlyIncome >= 500) score += 25;
    else if (monthlyIncome >= 100) score += 10;

    // Experience Weight (Max 30 points)
    if (completedTrips >= 500) score += 30;
    else if (completedTrips >= 100) score += 20;
    else if (completedTrips >= 20) score += 10;

    // Quality Weight (Max 30 points)
    if (rating >= 4.8) score += 30;
    else if (rating >= 4.5) score += 20;
    else if (rating >= 4.0) score += 10;

    // Cap score at strict boundaries
    return Math.min(Math.max(score, 0), 100);
}

module.exports = { calculateScore };
