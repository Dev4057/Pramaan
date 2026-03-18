const { createWalletClient, http, parseAbi, createPublicClient } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const { sepolia } = require('viem/chains'); 
require('dotenv').config(); // Ensure env variables are loaded if not already

// Load config securely
const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY || '0x99048042cdfb07482e981fa6b6dd65e5e00db62a52d2af14ffb6fc1b2e979373'; // Default to dummy locally
const RPC_URL = process.env.RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

/**
 * Validates variables to ensure they are present
 */
function ensureConfig() {
    if (!CONTRACT_ADDRESS) {
        console.warn("CONTRACT_ADDRESS not set in environment.");
    }
}

/**
 * Mints the calculated GigScore to the blockchain via the Agent Wallet.
 * @param {string} workerAddress - The user's wallet address
 * @param {number} score - The deterministic integer score
 * @param {string} dataHash - The hash of the verified Reclaim payload
 * @returns {string} Transaction Hash
 */
async function mintGigScore(workerAddress, score, dataHash) {
    ensureConfig();
    try {
        const account = privateKeyToAccount(PRIVATE_KEY);
        const client = createWalletClient({
            account,
            chain: sepolia, // Make configurable if needed
            transport: http(RPC_URL)
        });

        const abi = parseAbi([
            'function updateGigScore(address _worker, uint8 _score, string memory _dataHash) external'
        ]);

        const txHash = await client.writeContract({
            address: CONTRACT_ADDRESS,
            abi,
            functionName: 'updateGigScore',
            args: [workerAddress, score, dataHash]
        });

        return txHash;

    } catch (error) {
        console.error("Critical Blockchain Minting Error:", error);
        throw new Error("Failed to mint score to blockchain");
    }
}

/**
 * Reads a worker's profile directly from the smart contract
 * @param {string} workerAddress 
 * @returns {Object} { score, expiresAt, isDefaulted, exists }
 */
async function getOnChainProfile(workerAddress) {
    ensureConfig();
    try {
        const client = createPublicClient({
            chain: sepolia,
            transport: http(RPC_URL)
        });

        const abi = parseAbi([
            'struct WorkerProfile { bool identityVerified; bool incomeVerified; uint8 gigScore; uint256 lastUpdated; uint256 revision; string identityDdocId; string incomeDdocId; string platform; string identityProofHash; string incomeProofHash; bytes32 identityNullifier; bytes32 incomeNullifier; bytes32 identityCommitment; bytes32 incomeCommitment; bool exists; uint256 expiresAt; bool isDefaulted; }',
            'function getWorkerProfile(address _worker) external view returns (WorkerProfile)'
        ]);

        const profile = await client.readContract({
            address: CONTRACT_ADDRESS,
            abi,
            functionName: 'getWorkerProfile',
            args: [workerAddress]
        });

        return {
            exists: profile.exists,
            score: profile.gigScore,
            expiresAt: Number(profile.expiresAt),
            isDefaulted: profile.isDefaulted
        };
    } catch (error) {
        console.error("Blockchain Read Error:", error);
        throw new Error("Failed to read on-chain profile");
    }
}

module.exports = { mintGigScore, getOnChainProfile };
