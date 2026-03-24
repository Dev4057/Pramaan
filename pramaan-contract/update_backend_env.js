const fs = require('fs');
let env = fs.readFileSync('/home/devangandhi/pramaan/backend/.env', 'utf8');
env = env.replace(/CONTRACT_ADDRESS=0x36C76e4B28997698819356C0C18e5892D168893B/, 'CONTRACT_ADDRESS=0xA450544019538B8f580A8B33D7aF69185F9e468d');
env = env.replace(/RPC_URL=https:\/\/sepolia.infura.io\/v3\/e0ba68cb5c414cd69cbe84493b3c5f59/, 'RPC_URL=https://sepolia.base.org');
fs.writeFileSync('/home/devangandhi/pramaan/backend/.env', env);
console.log("Backend env updated!");
