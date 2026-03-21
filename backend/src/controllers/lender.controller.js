// backend/src/controllers/lender.controller.js
const crypto = require('crypto');
const ActuarialScoring = require('../services/ActuarialScoring');
const AgentReport = require('../services/AgentReport');
const OnChainMinter = require('../services/OnChainMinter');
const prisma = require('../config/prisma');

/**
 * Orchestrates the complete end-to-end lifecycle of a user's reputation score generation.
 * Ties together the deterministic math engine, cryptographic hashing, blockchain minter,
 * and the AI text generator in a strict, sequential pipeline.
 *
 * @param {Object} req - The Express request object.
 * @param {Object} res - The Express response object.
 */
async function processAndMintScore(req, res) {
    try {
        // Step A: Data Extraction
        const { workerAddress, verifiedData } = req.body;
        const { income, trips, rating } = verifiedData;

        // Step B: Deterministic Scoring (Math)
        // Calculating score synchronously using the verified data.
        const finalScore = ActuarialScoring.calculateGigScore(verifiedData);

        // Step C: Cryptographic Data Hashing
        // Creating a SHA-256 hash formatting it as an "0x" prefixed hex string
        const dataHash = "0x" + crypto.createHash('sha256').update(JSON.stringify(verifiedData)).digest('hex');

        // Step D: Blockchain State Commitment (The Source of Truth)
        // This MUST succeed for the flow to continue.
        const txHash = await OnChainMinter.mintGigScore(workerAddress, finalScore, dataHash);

        // Step E: AI Risk Narrative Generation (NLG)
        const aiAnalysis = await AgentReport.generateRiskReport(finalScore, verifiedData);

        // Step F: HTTP Response
        return res.status(200).json({
            status: "Success",
            message: "Soulbound GigScore successfully minted to Sepolia.",
            score: finalScore,
            transactionHash: txHash,
            ai_analysis: aiAnalysis
        });

    } catch (error) {
        console.error("Score Formulation Architecture Pipeline Error:", error);
        return res.status(500).json({ error: "System failure during score generation and minting." });
    }
}

/**
 * Enforce State Consistency (The "Read-Through Cache" Rule)
 * Endpoint: GET /api/lender/report/:address
 */
async function getLenderReport(req, res) {
    try {
        const workerAddress = req.params.address;
        
        // 1. Query the Smart Contract First (Source of Truth)
        const profile = await OnChainMinter.getOnChainProfile(workerAddress);

        // 2. Validate Profile Rules
        if (!profile.exists || profile.score === 0) {
            return res.status(404).json({ error: "Worker profile not found on-chain." });
        }

        const nowSeconds = Math.floor(Date.now() / 1000);
        if (profile.isDefaulted) {
            return res.status(403).json({ error: "User profile invalid or defaulted." });
        }
        
        if (profile.expiresAt < nowSeconds) {
            return res.status(403).json({ error: "Score has expired. Re-verify data required." });
        }

        // 3. Fetch detailed context purely from cache (DB)
        const cacheEntry = await prisma.scoreProfile.findUnique({
            where: { walletAddress }
        });
        
        // Ensure cache aligns with chain realistically
        if (!cacheEntry) {
             return res.status(404).json({ error: "Detailed report not found in cache." });
        }

        return res.status(200).json({
            status: "Valid",
            onChainScore: profile.score,
            expiresAt: profile.expiresAt,
            ai_analysis: cacheEntry.aiRiskReport,
            recentTxHash: cacheEntry.lastTxHash
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

module.exports = { processAndMintScore, getLenderReport };
