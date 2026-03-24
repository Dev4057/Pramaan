const fs = require('fs');
let code = fs.readFileSync('/home/devangandhi/pramaan/backend/index.js', 'utf8');

const targetStr = `    let rawContributions = contextObj?.extractedParameters?.contributions || proof?.extractedParameterValues?.contributions || '0';`;
const replaceStr = `    // Extract parameters whatever Reclaim decides to call them
    const params = Object.assign({}, proof?.extractedParameterValues, contextObj?.extractedParameters);
    console.log("🔍 RECLAIM PARAMS RECEIVED:", params);
    
    // Try to find contributions directly, or any number in the params
    let rawContributions = params.contributions || params.totalContributions || params.commits || params.yearlyContributions;
    
    if (!rawContributions) {
        // Fallback: look for the first parameter that looks like a valid large number string (e.g. "423")
        const possibleNumbers = Object.values(params).filter(v => typeof v === 'string' && !isNaN(parseInt(v.replace(/,/g, ''), 10)) && parseInt(v.replace(/,/g, ''), 10) > 0);
        rawContributions = possibleNumbers.length > 0 ? possibleNumbers[0] : '0';
    }`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('/home/devangandhi/pramaan/backend/index.js', code);
console.log("Patched successfully!");
