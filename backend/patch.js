const fs = require('fs');
let code = fs.readFileSync('backend/index.js', 'utf8');
code = code.replace(/    let aiScore;[\s\S]*?if \(isNaN\(aiScore\) \|\| aiScore < 50 \|\| aiScore > 95\) {\n        aiScore = calculateDeveloperScore\(proofState\?\.contributions \|\| 0\);\n    }/, `    let aiScore = calculateDeveloperScore(proofState?.contributions || 0);`);
fs.writeFileSync('backend/index.js', code);
