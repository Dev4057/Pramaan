const fs = require('fs');
let code = fs.readFileSync('index.js', 'utf8');

const startIndex = code.indexOf(`    log('🤖', 'HEYELSA', \`Initiating OpenClaw analysis for \${walletAddress}\`)`);
const endIndex = code.indexOf(`    log('⛓️', 'STEP 3', \`Minting GigScore \${aiScore} to Pramaan Smart Contract...\`);`);

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `
    const calcScore = calculateDeveloperScore(proofState?.contributions || 0);
    const aiScore = calcScore;

`;
  code = code.substring(0, startIndex) + replacement + code.substring(endIndex);
  fs.writeFileSync('index.js', code);
  console.log("Patched successfully!");
} else {
  console.log("Indexes not found");
}
