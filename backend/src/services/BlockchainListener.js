const { createPublicClient, http, webSocket, parseAbiItem } = require('viem');
const { sepolia } = require('viem/chains');
const prisma = require('../config/prisma');

/**
 * Initializes and starts the blockchain event listener to synchronize on-chain state with the off-chain database.
 * Specifically listens for 'ScoreSlashed' events to instantly update a worker's defaulted status and revoke favorable AI reports.
 * 
 * @returns {void}
 */
async function startListener() {
    try {
        const rpcUrl = process.env.WSS_RPC_URL || process.env.RPC_URL;
        const contractAddress = process.env.CONTRACT_ADDRESS;

        if (!rpcUrl || !contractAddress) {
            console.error("CRITICAL: Missing RPC_URL or CONTRACT_ADDRESS for BlockchainListener.");
            return;
        }

        // 1. Initialize Client (Prefer WebSocket if available, fallback to HTTP)
        const transport = rpcUrl.startsWith('wss') ? webSocket(rpcUrl) : http(rpcUrl);
        const client = createPublicClient({
            chain: sepolia,
            transport: transport,
        });

        // 2. Define Event ABI
        const scoreSlashedEvent = parseAbiItem('event ScoreSlashed(address indexed worker, address indexed lender, uint256 timestamp)');

        // 3. Watch Event
        console.log(`Starting BlockchainListener for contract: ${contractAddress}`);
        
        client.watchEvent({
            address: contractAddress,
            event: scoreSlashedEvent,
            onLogs: async (logs) => {
                for (const log of logs) {
                    const { worker, lender, timestamp } = log.args;
                    console.log(`[BlockchainListener] ScoreSlashed event detected for worker: ${worker} by lender: ${lender}`);

                    // 4. Execute Database Mutation (Prisma)
                    try {
                        const updatedProfile = await prisma.scoreProfile.update({
                            where: { walletAddress: worker },
                            data: {
                                isDefaulted: true,
                                computedScore: 30, // Reset to baseline
                                aiRiskReport: "ACCOUNT IN DEFAULT. Previous favorable analysis has been revoked due to an on-chain slashing event."
                            }
                        });
                        console.log(`[BlockchainListener] Successfully updated database for defaulted worker: ${worker}`);
                    } catch (dbError) {
                         // Critical error: The database is now out of sync with the blockchain.
                        console.error(`[CRITICAL] Failed to update database for defaulted worker: ${worker}. Database is out of sync! Error:`, dbError);
                    }
                }
            },
            onError: (error) => {
                console.error("[BlockchainListener] Event Subscription Error:", error);
            }
        });

    } catch (error) {
        console.error("Failed to start BlockchainListener:", error);
    }
}

module.exports = { startListener };