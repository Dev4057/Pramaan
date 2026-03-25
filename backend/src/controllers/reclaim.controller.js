const crypto = require('crypto');
const { verifyProof } = require('@reclaimprotocol/js-sdk');
const ActuarialScoring = require('../services/ActuarialScoring');
const AgentReport = require('../services/AgentReport');
const OnChainMinter = require('../services/OnChainMinter');

async function handleReclaimWebhook(req, res) {
    try {
        // 1. Support workerAddress from body (frontend fetch) or query params (Reclaim backend callback)
        const workerAddress = req.body.workerAddress || req.query.workerAddress;

        // 2. Robustly extract proofs depending on the caller's payload structure
        let proofs = req.body.proofs;
        if (!proofs) {
            proofs = Array.isArray(req.body) ? req.body : (req.body?.claimData ? [req.body] : []);
        }

        if (!proofs || proofs.length === 0 || !workerAddress) {
            return res.status(400).json({ error: "Missing proofs or workerAddress. If using setAppCallbackUrl, ensure ?workerAddress=... is appended to the URL." });
        }

        // 3. Cryptographically verify the proof
        const isValid = await verifyProof(proofs[0]);
        if (!isValid) {
            return res.status(400).json({ error: "Invalid Reclaim proof signature" });
        }

        // 4. Extract the GitHub contributions variable
        const extractedParams = proofs[0].extractedParameterValues || {};
        const rawContributions = extractedParams.contributions || extractedParams.totalContributions;

        if (!rawContributions) {
            return res.status(400).json({ error: "Contributions data missing in proof" });
        }

        // Strip commas and parse to integer (e.g., "1,200" -> 1200)
        const contributionsCount = parseInt(String(rawContributions).replace(/,/g, ''), 10);
        
        if (isNaN(contributionsCount) || contributionsCount < 0) {
            return res.status(400).json({ error: "Parsed contributions count is completely invalid" });
        }

        // 3. Calculate Developer Score
        const finalScore = ActuarialScoring.calculateDeveloperScore(contributionsCount);
        
        // 4. Hash verified data
        const dataToHash = { contributions: contributionsCount };
        const dataHash = "0x" + crypto.createHash('sha256').update(JSON.stringify(dataToHash)).digest('hex');

        // 5. Mint GigScore
        const txHash = await OnChainMinter.mintGigScore(workerAddress, finalScore, dataHash);
        if (!txHash) throw new Error("Transaction hash not returned from blockchain");
        
        // 6. Generate Risk Report
        const aiAnalysis = await AgentReport.generateRiskReport(finalScore, contributionsCount);

        // Return finalize payload
        return res.status(200).json({
            status: "Success",
            message: "Soulbound Developer Score successfully minted to Sepolia.",
            score: finalScore,
            transactionHash: txHash,
            ai_analysis: aiAnalysis
        });

    } catch (error) {
        console.error("Webhook processing error:", error);
        return res.status(500).json({ error: "Webhook processing failed" });
    }
}

module.exports = { handleReclaimWebhook };
