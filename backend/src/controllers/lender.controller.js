// backend/src/controllers/lender.controller.js
const ActuarialScoring = require('../services/ActuarialScoring');
const AgentReport = require('../services/AgentReport');

async function processUserVerification(req, res) {
    try {
        // 1. Get raw verified Reclaim data
        const { income, trips, rating } = req.body.verifiedData;

        // 2. Execute strict math (Deterministic)
        const finalScore = ActuarialScoring.calculateScore(income, trips, rating);

        // 3. Generate textual report via AI based on that math
        const report = await AgentReport.generateRiskReport(finalScore, { income, trips, rating });

        // 4. Return to frontend (or save to DB to wait for x402 payment)
        return res.status(200).json({
            score: finalScore,
            ai_analysis: report
        });

    } catch (error) {
        return res.status(500).json({ error: "System failure during assessment" });
    }
}

module.exports = { processUserVerification };
