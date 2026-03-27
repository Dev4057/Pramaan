const fs = require('fs');
let code = fs.readFileSync('/home/devangandhi/pramaan/backend/index.js', 'utf8');

code = code.replace(/    const { publicClient: sepoliaPublicClient, walletClient: sepoliaWalletClient, account } = getAgentClients()/, `    const account = privateKeyToAccount(AGENT_PRIVATE_KEY);`);
code = code.replace(/    const txHash = await sepoliaWalletClient\.writeContract\(/, '    const txHash = await baseWalletClient.writeContract(');
code = code.replace(/    await sepoliaPublicClient\.waitForTransactionReceipt\({ hash: txHash }\)/, '    await basePublicClient.waitForTransactionReceipt({ hash: txHash })');

fs.writeFileSync('/home/devangandhi/pramaan/backend/index.js', code);
console.log("Backend now natively pushing to Base Sepolia for everything!");
