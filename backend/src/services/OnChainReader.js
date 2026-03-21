const { createPublicClient, http, parseAbi } = require('viem');
const { sepolia } = require('viem/chains');

/**
 * Validates a worker's on-chain profile state to determine if off-chain metadata can be served.
 * Provides strictly isolated EVM read operations to enforce the Read-Through Cache architecture.
 *
 * @param {string} workerAddress - The EVM address of the worker to validate.
 * @returns {Promise<Object>} The validation result containing isValid flag, onChainState, and a semantic message.
 * @throws {Error} If the RPC node is down or the contract call fails.
 */
async function validateWorkerState(workerAddress) {
  try {
    const rpcUrl = process.env.RPC_URL;
    const contractAddress = process.env.CONTRACT_ADDRESS;

    // 1. Initialize Client
    const client = createPublicClient({
      chain: sepolia,
      transport: http(rpcUrl),
    });

    // 2. Define ABI
    const abi = parseAbi([
      'function profiles(address) external view returns (uint256 score, uint256 expiresAt, bool isDefaulted, string dataHash)'
    ]);

    // 3. Execute Contract Read
    const profile = await client.readContract({
      address: contractAddress,
      abi: abi,
      functionName: 'profiles',
      args: [workerAddress],
    });

    const [score, expiresAt, isDefaulted, dataHash] = profile;

    // 4. Fetch Block Timestamp
    const block = await client.getBlock();
    const currentTimestamp = block.timestamp;

    // Convert bigints to Numbers for calculation and JSON serialization
    const scoreNum = Number(score);
    const expiresAtNum = Number(expiresAt);
    const currentTimestampNum = Number(currentTimestamp);

    // 5. Evaluate Validity
    let isValid = false;
    let message = 'Valid profile';

    if (scoreNum === 0) {
      isValid = false;
      message = 'No profile found';
    } else if (isDefaulted === true) {
      isValid = false;
      message = 'Profile defaulted';
    } else if (expiresAtNum <= currentTimestampNum) {
      isValid = false;
      message = 'Profile expired';
    } else {
      isValid = true;
      message = 'Valid profile';
    }

    return {
      isValid: isValid,
      onChainState: {
        score: scoreNum,
        expiresAt: expiresAtNum,
        isDefaulted: isDefaulted,
        dataHash: dataHash,
      },
      message: message,
    };
  } catch (error) {
    console.error('Error in validateWorkerState:', error);
    throw new Error('Failed to verify on-chain state. Cannot proceed safely.');
  }
}

module.exports = { validateWorkerState };
