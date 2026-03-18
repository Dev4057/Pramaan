// backend/src/controllers/lender.controller.js
const ActuarialScoring = require('../services/ActuarialScoring');
const AgentReport = require('../services/AgentReport');
const OnChainMinter = require('../services/OnChainMinter');

// Mock Database (Replace with actual Database later, e.g., Prisma)
const mockDatabase = {};

// Assuming this function is triggered after Reclaim data is successfully verified
async function processAndMintScore(req, res) {
    try {
        const { workerAddress, verifiedData } = req.body;
        const { income, trips, rating } = verifiedData;

        // 1. Calculate deterministic score (Math)
        const finalScore = ActuarialScoring.calculateScore(income, trips, rating);

        // 2. Generate a secure hash of the raw data for on-chain anchoring
        // Using a simple mock hash for demonstration
        const dataHash = `0x${Buffer.from(JSON.stringify(verifiedData)).toString('hex').slice(0, 64)}`; 

        // 3. Mint the score to the Blockchain (The Source of Truth)
        console.log(`Minting score ${finalScore} for ${workerAddress}...`);
        const txHash = await OnChainMinter.mintGigScore(workerAddress, finalScore, dataHash);

        // 4. Generate the Human-Readable Risk Report (AI)
        const aiReport = await AgentReport.generateRiskReport(finalScore, verifiedData);

        // 5. Save to Database (Acting strictly as Off-Chain Cache)
        mockDatabase[workerAddress.toLowerCase()] = {
            currentScore: finalScore, 
            riskReport: aiReport, 
            lastTxHash: txHash 
        };

        return res.status(200).json({
            status: "Success",
            message: "Soulbound GigScore Minted",
            score: finalScore,
            transactionHash: txHash,
            reportReady: true
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
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
        const cacheEntry = mockDatabase[workerAddress.toLowerCase()];
        
        // Ensure cache aligns with chain realistically
        if (!cacheEntry) {
             // Rebuild report if possible, or fail gracefully
             return res.status(404).json({ error: "Detailed report not found in cache." });
        }

        return res.status(200).json({
            status: "Valid",
            onChainScore: profile.score,
            expiresAt: profile.expiresAt,
            ai_analysis: cacheEntry.riskReport,
            recentTxHash: cacheEntry.lastTxHash
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}

module.exports = { processAndMintScore, getLenderReport };
