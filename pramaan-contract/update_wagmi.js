const fs = require('fs');
let code = fs.readFileSync('/home/devangandhi/pramaan/pramaan-app/src/App.jsx', 'utf8');
code = code.replace(/chains: \[sepolia, baseSepolia\],/, 'chains: [baseSepolia, sepolia],');
fs.writeFileSync('/home/devangandhi/pramaan/pramaan-app/src/App.jsx', code);
console.log("Wagmi chains updated to default to Base!");
