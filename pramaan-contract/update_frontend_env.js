const fs = require('fs');
let env = fs.readFileSync('/home/devangandhi/pramaan/pramaan-app/.env', 'utf8');
env = env.replace(/VITE_CONTRACT_ADDRESS=0x36C76e4B28997698819356C0C18e5892D168893B/, 'VITE_CONTRACT_ADDRESS=0xA450544019538B8f580A8B33D7aF69185F9e468d');
fs.writeFileSync('/home/devangandhi/pramaan/pramaan-app/.env', env);
console.log("Frontend env updated!");
