const fs = require('fs');
const file = '/home/devangandhi/pramaan/backend/index.js';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(
  'const contributionsCount = parseInt(cleanContributions, 10);',
  `const contributionsCount = parseInt(cleanContributions, 10);\n    console.log("🧮 PARSED CONTRIBUTIONS:", contributionsCount);`
);

fs.writeFileSync(file, content);
