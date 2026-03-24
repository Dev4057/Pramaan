const { createPublicClient, http } = require('viem');
const { baseSepolia } = require('viem/chains');

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org')
});

const ABI = [
  { "type": "function", "name": "workers", "inputs": [{"name":"","type":"address"}], "outputs": [{"name":"exists","type":"bool"},{"name":"identityVerified","type":"bool"},{"name":"incomeVerified","type":"bool"},{"name":"gigScore","type":"uint8"},{"name":"identityDdocId","type":"string"},{"name":"incomeDdocId","type":"string"}], "stateMutability": "view" }
];

async function main() {
  const result = await publicClient.readContract({
    address: '0xA450544019538B8f580A8B33D7aF69185F9e468d',
    abi: ABI,
    functionName: 'workers',
    args: ['0xa60d26d641fC807C9659df3f1A5E24Dc54C6baD7']
  });
  console.log(result);
}
main().catch(console.error);
