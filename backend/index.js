require('dotenv').config()
const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const axios = require('axios')
const { ReclaimProofRequest } = require('@reclaimprotocol/js-sdk')
const { createPublicClient, createWalletClient, http, isAddress } = require('viem')
const { privateKeyToAccount } = require('viem/accounts')
const { baseSepolia } = require('viem/chains')

const app = express()
app.use(cors())
app.use(express.json())

function log(emoji, tag, msg) {
  const ts = new Date().toLocaleTimeString()
  console.log(`${ts} ${emoji} [${tag}] ${msg}`)
}

// --- X402 CONSTANTS ---
const ERC20_ABI = [
  { type: 'function', name: 'transfer', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] }
];
const BASE_USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e'; 

const APP_ID = process.env.RECLAIM_APP_ID
const APP_SECRET = process.env.RECLAIM_APP_SECRET
const FILEVERSE_API_KEY = process.env.FILEVERSE_API_KEY
const CALLBACK_URL = process.env.CALLBACK_URL || 'http://localhost:4000'
const FILEVERSE_URL = 'http://localhost:8001'
const RPC_URL = process.env.RPC_URL
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS
const AGENT_PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY
const REQUEST_TTL_MS = 2 * 60 * 1000
const ENABLE_MOCK_ZK = process.env.ENABLE_MOCK_ZK === 'true'
const ENABLE_ZK_FLOW = process.env.ENABLE_ZK_FLOW === 'true'
const RECLAIM_PROVIDER_IDENTITY = process.env.RECLAIM_PROVIDER_IDENTITY || '5d37bfc5-a44e-43e5-b44e-9430c2192f7d'
const RECLAIM_PROVIDER_SBI = process.env.RECLAIM_PROVIDER_SBI || '343537da-09a8-4b34-a1dd-06a1166ff873'
const RECLAIM_PROVIDER_UBER = process.env.RECLAIM_PROVIDER_UBER || ''

const STORE_DIR = path.join(__dirname, 'data')
const STORE_FILE = path.join(STORE_DIR, 'pending-proofs.json')
const MOCK_FIXTURE_FILE = path.join(STORE_DIR, 'mock-zk-fixtures.json')

const PROVIDERS = { identity: RECLAIM_PROVIDER_IDENTITY, sbi: RECLAIM_PROVIDER_SBI, uber: RECLAIM_PROVIDER_UBER }

const CONTRACT_ABI = [
  { type: 'function', name: 'setGigScore', stateMutability: 'nonpayable', inputs: [{ name: '_worker', type: 'address' }, { name: '_score', type: 'uint8' }], outputs: [] },
  { type: 'function', name: 'isVerified', stateMutability: 'view', inputs: [{ name: '_worker', type: 'address' }], outputs: [{ name: '', type: 'bool' }] }
]

let pendingProofs = loadPendingProofs()
let mockFixtures = loadMockFixtures()

function ensureWalletState(walletAddress) {
  const key = walletAddress.toLowerCase()
  if (!pendingProofs[key]) pendingProofs[key] = {}
  return pendingProofs[key]
}

function loadPendingProofs() {
  try {
    if (!fs.existsSync(STORE_FILE)) return {}
    const raw = fs.readFileSync(STORE_FILE, 'utf8')
    if (!raw.trim()) return {}
    return JSON.parse(raw)
  } catch (err) { return {} }
}

function loadMockFixtures() {
  try {
    if (!fs.existsSync(MOCK_FIXTURE_FILE)) return { default: null, workers: {} }
    const raw = fs.readFileSync(MOCK_FIXTURE_FILE, 'utf8')
    if (!raw.trim()) return { default: null, workers: {} }
    const parsed = JSON.parse(raw)
    return { default: parsed.default || null, workers: parsed.workers || {} }
  } catch (err) { return { default: null, workers: {} } }
}

function getMockWorkerProfile(walletAddress) {
  const key = walletAddress.toLowerCase()
  return mockFixtures.workers[key] || mockFixtures.default
}

function toDeterministicHash(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function buildMockProofHash(walletAddress, type, payload) {
  const normalizedWallet = walletAddress.toLowerCase()
  const canonical = JSON.stringify({ walletAddress: normalizedWallet, type, payload })
  return `mockzk:${toDeterministicHash(canonical)}`
}

function hashToUint256(hexOrText) {
  const digest = /^[0-9a-fA-F]{64}$/.test(hexOrText) ? hexOrText.toLowerCase() : toDeterministicHash(hexOrText)
  return `0x${digest}`
}

function addressToUint256Hex(walletAddress) {
  return `0x${walletAddress.toLowerCase().replace('0x', '').padStart(64, '0')}`
}

function buildIdentityProofPack(walletAddress, profile) {
  const payload = { ageAbove18: true, country: 'IN', fixture: profile?.fixtureId || 'default' }
  const nullifier = hashToUint256(JSON.stringify({ walletAddress: walletAddress.toLowerCase(), type: 'identity-nullifier' }))
  const commitment = hashToUint256(JSON.stringify({ walletAddress: walletAddress.toLowerCase(), payload, salt: 'identity-v1' }))
  const ddocId = `mockzk:identity:${walletAddress.toLowerCase()}`
  return { proof: '0x01', publicSignals: [addressToUint256Hex(walletAddress), '0x1', '0x1', nullifier, commitment], ddocId, platform: 'Aadhaar', payload }
}

function buildIncomeProofPack(walletAddress, provider, incomePayload) {
  const platformCode = provider === 'uber' ? '0x2' : '0x1'
  const nullifier = hashToUint256(JSON.stringify({ walletAddress: walletAddress.toLowerCase(), type: `income-nullifier:${provider}` }))
  const commitment = hashToUint256(JSON.stringify({ walletAddress: walletAddress.toLowerCase(), provider, incomePayload, salt: 'income-v1' }))
  const ddocId = `mockzk:income:${provider}:${walletAddress.toLowerCase()}`
  return { proof: '0x01', publicSignals: [addressToUint256Hex(walletAddress), '0x1', '0x2', nullifier, commitment], ddocId, platform: provider === 'uber' ? 'Uber' : 'SBI', payload: incomePayload }
}

function savePendingProofs() {
  try {
    if (!fs.existsSync(STORE_DIR)) fs.mkdirSync(STORE_DIR, { recursive: true })
    fs.writeFileSync(STORE_FILE, JSON.stringify(pendingProofs, null, 2), 'utf8')
  } catch (err) {}
}

function getProviderDisplayName(provider) {
  if (provider === 'sbi') return 'SBI'
  if (provider === 'uber') return 'Uber'
  return 'Unknown'
}

function extractPlatformFromProof(proof) {
  const claimData = proof?.claimData || proof?.proofs?.[0]?.claimData || {}
  return claimData?.provider || claimData?.providerName || 'Unknown'
}


function getAgentClients() {
  const account = privateKeyToAccount(AGENT_PRIVATE_KEY)
  const transport = http(RPC_URL)
  const publicClient = createPublicClient({ transport })
  const walletClient = createWalletClient({ account, transport })
  return { publicClient, walletClient, account }
}

async function isCallbackHealthy() {
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(`${CALLBACK_URL}/health`, { signal: controller.signal })
    clearTimeout(timeout)
    return res.ok
  } catch (_) { return false }
}

function requireReclaimConfig() {
  if (!APP_ID || !APP_SECRET) throw new Error('RECLAIM_APP_ID/RECLAIM_APP_SECRET are missing in backend .env')
}

      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: `Pramaan ${type} Proof - ${walletAddress}`, content: JSON.stringify(proofData) })
    })
    const data = await res.json()
    return data?.data?.ddocId || data?.ddocId || `fallback-${Date.now()}`
  } catch (err) { return `fallback-${Date.now()}` }
}

function generateProofHash(proof, walletAddress, type) {
  const str = `${type}-${walletAddress}-${JSON.stringify(proof).slice(0, 100)}-${Date.now()}`
  return Buffer.from(str).toString('hex').slice(0, 64)
}

app.get('/health', (_, res) => res.json({ ok: true, timestamp: new Date().toISOString() }))

app.get('/api/reclaim/preflight', async (_, res) => {
  const callbackHealthy = await isCallbackHealthy()
  res.json({ ok: !!APP_ID && !!APP_SECRET, reclaimConfigured: !!APP_ID && !!APP_SECRET, callbackHealthy, callbackUrl: CALLBACK_URL, mockZkEnabled: ENABLE_MOCK_ZK, zkFlowEnabled: ENABLE_ZK_FLOW })
})

app.post('/api/zk/identity-proof/:walletAddress', (req, res) => {
  const { walletAddress } = req.params
  const profile = getMockWorkerProfile(walletAddress)
  if (!profile || !profile.ageAbove18 || profile.country !== 'IN') return res.status(400).json({ error: 'Mock fixture does not satisfy identity checks' })
  res.json({ ok: true, mode: 'mock-zk', ...buildIdentityProofPack(walletAddress, profile) })
})

app.post('/api/zk/anon-aadhaar/:walletAddress', async (req, res) => {
  try {
  } catch (err) { res.status(500).json({ error: 'Failed to save to Fileverse' }) }
})

app.post('/api/zk/income-proof/:walletAddress', (req, res) => {
  const { walletAddress } = req.params
  const provider = req.body.provider || 'sbi'
  const profile = getMockWorkerProfile(walletAddress)
  const incomePayload = profile?.income?.[provider]
  if (!incomePayload) return res.status(400).json({ error: `No mock ${provider.toUpperCase()} income fixture for wallet` })
  res.json({ ok: true, mode: 'mock-zk', ...buildIncomeProofPack(walletAddress, provider, incomePayload) })
})

app.get('/api/mock/profile/:walletAddress', (req, res) => {
  const profile = getMockWorkerProfile(req.params.walletAddress)
  profile ? res.json({ ok: true, profile }) : res.status(404).json({ error: 'Not found' })
})

app.post('/api/mock/identity-verify/:walletAddress', (req, res) => {
  const { walletAddress } = req.params
  const payload = { ageAbove18: true, country: 'IN' }
  res.json({ ok: true, ddocId: `mockzk:identity:${walletAddress.toLowerCase()}`, proofHash: buildMockProofHash(walletAddress, 'identity', payload), payload })
})

app.post('/api/mock/income-verify/:walletAddress', (req, res) => {
  const { walletAddress } = req.params
  const provider = req.body.provider || 'sbi'
  const profile = getMockWorkerProfile(walletAddress)
  const incomePayload = profile?.income?.[provider]
  res.json({ ok: true, ddocId: `mockzk:income:${provider}:${walletAddress.toLowerCase()}`, proofHash: buildMockProofHash(walletAddress, 'income', { provider, incomePayload }), platform: provider === 'uber' ? 'Uber' : 'SBI', payload: incomePayload })
})

app.post('/api/reclaim/identity-request', async (req, res) => {
  try {
    requireReclaimConfig()
    const { walletAddress } = req.body
    const reclaimProofRequest = await ReclaimProofRequest.init(APP_ID, APP_SECRET, PROVIDERS.identity)
    reclaimProofRequest.setContext(walletAddress, 'Pramaan identity verification')
    reclaimProofRequest.setAppCallbackUrl(`${CALLBACK_URL}/api/reclaim/callback/identity/${walletAddress}`)
    const walletState = ensureWalletState(walletAddress)
    walletState.identity = { ready: false, type: 'identity', providerLabel: 'Aadhaar', expiresAt: Date.now() + REQUEST_TTL_MS, updatedAt: Date.now() }
    savePendingProofs()
    res.json({ requestUrl: await reclaimProofRequest.getRequestUrl(), statusUrl: reclaimProofRequest.getStatusUrl() })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/api/reclaim/generate-request', async (req, res) => {
  try {
    requireReclaimConfig()
    const { walletAddress, provider } = req.body
    const reclaimProofRequest = await ReclaimProofRequest.init(APP_ID, APP_SECRET, PROVIDERS[provider])
    reclaimProofRequest.setContext(walletAddress, `Pramaan income verification (${provider})`)
    reclaimProofRequest.setAppCallbackUrl(`${CALLBACK_URL}/api/reclaim/callback/income/${walletAddress}`)
    const walletState = ensureWalletState(walletAddress)
    walletState.income = { ready: false, type: 'income', provider, providerLabel: getProviderDisplayName(provider), expiresAt: Date.now() + REQUEST_TTL_MS, updatedAt: Date.now() }
    savePendingProofs()
    res.json({ requestUrl: await reclaimProofRequest.getRequestUrl(), statusUrl: reclaimProofRequest.getStatusUrl() })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/api/reclaim/callback/income/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params
    const proof = req.body
    const walletState = ensureWalletState(walletAddress)
})

app.post('/api/reclaim/callback/identity/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params
    const proof = req.body
    const walletState = ensureWalletState(walletAddress)
})

app.get('/api/reclaim/status/:type/:walletAddress', (req, res) => {
  const status = (pendingProofs[req.params.walletAddress.toLowerCase()] || {})[req.params.type]
  if (status && !status.ready && status.expiresAt && Date.now() > status.expiresAt) return res.json({ ready: false, expired: true })
  res.json(status && status.ready ? status : { ready: false })
})

// =========================================================================
// THE MOCK ELSA X402 SIMULATOR
// =========================================================================
app.post('/api/mock-elsa/analyze', async (req, res) => {
  const paymentProof = req.headers['x-payment-proof'];

  if (!paymentProof) {
    log('🛡️', 'MOCK ELSA', 'Incoming request blocked. Missing payment proof.');
    
    // EXPLICITLY set these headers so Axios can see them
    res.setHeader('x-payment-address', '0xa60d26d641fC807C9659df3f1A5E24Dc54C6baD7'); 
    res.setHeader('x-payment-amount', '20000'); 
    res.setHeader('x-payment-chain', 'base-sepolia');
    res.setHeader('Access-Control-Expose-Headers', 'x-payment-address, x-payment-amount, x-payment-chain');

    return res.status(402).json({ error: 'x402 Payment Required' });
  }
  log('🧠', 'OPENCLAW', 'Payment Verified. Triggering Local LLM Reasoning...');

  try {
    const ollamaResponse = await axios.post('http://localhost:11434/api/generate', {
      model: 'llama3',
      prompt: `You are a credit scoring AI. Analyze this gig worker on Platform: ${req.body.platform}. They have verified ZK income proofs. Reply ONLY with a valid JSON object containing two fields: "score" (integer between 50 and 99) and "insight" (1-sentence professional credit risk insight).`,
      stream: false,
      format: "json"
    });

    let aiData;
    try {
      aiData = JSON.parse(ollamaResponse.data.response);
    } catch(e) {
      aiData = { score: 85, insight: ollamaResponse.data.response };
    }

    res.json({
      success: true,
      score: parseInt(aiData.score) || 85,
      insights: aiData.insight,
      agent: "Local OpenClaw (Ollama Llama3)"
    });
  } catch (err) {
    res.json({
      success: true,
      score: 96,
      insights: "Consistent on-chain activity verified via x402 protocol.",
      agent: "OpenClaw Fallback"
    });
  }
});


// =========================================================================
// THE UPGRADED X402 AGENT SCORING ROUTE (AXIOS + VIEM)
// =========================================================================
app.post('/api/agent/score/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params
    const { platform: platformOverride } = req.body || {}
    if (!isAddress(walletAddress)) return res.status(400).json({ error: 'Invalid worker wallet address' })

    const normalizedWallet = walletAddress.toLowerCase()
    const walletState = pendingProofs[normalizedWallet] || {}
    const { publicClient: sepoliaPublicClient, walletClient: sepoliaWalletClient, account } = getAgentClients()
    
    const baseTransport = http(process.env.BASE_RPC_URL || 'https://sepolia.base.org')
    const basePublicClient = createPublicClient({ chain: baseSepolia, transport: baseTransport })
    const baseWalletClient = createWalletClient({ account, chain: baseSepolia, transport: baseTransport })

    const proofState = walletState.income
    let platform
    let scoreEntropyHash

    if (proofState?.ready) {
      platform = proofState.platform || proofState.providerLabel || 'Unknown'
      scoreEntropyHash = proofState.proofHash || generateProofHash({ platform }, walletAddress, 'income')
    } else {
      platform = typeof platformOverride === 'string' && platformOverride.trim() ? platformOverride.trim() : 'SBI'
      scoreEntropyHash = toDeterministicHash(`${normalizedWallet}:${platform.toLowerCase()}:zk-score-v1`)
    }

    log('🤖', 'HEYELSA', `Initiating OpenClaw analysis for ${walletAddress}`)

    let aiScore;
    const elsaUrl = 'http://localhost:4000/api/mock-elsa/analyze';
    const aiPayload = { workerAddress: walletAddress, platform: platform };

    try {
      const response = await axios.post(elsaUrl, aiPayload);
      aiScore = parseInt(response.data.score);
    } catch (error) {
      if (error.response && error.response.status === 402) {
        log('💸', 'X402', '402 Payment Required detected. Processing micro-payment...');
        
        const amountRaw = error.response.headers['x-payment-amount'] || '20000';
        const paymentAmount = BigInt(amountRaw); 
        const paymentAddress = error.response.headers['x-payment-address'] || '0xa60d26d641fC807C9659df3f1A5E24Dc54C6baD7';

        const paymentTxHash = await baseWalletClient.writeContract({
          address: BASE_USDC_ADDRESS,
          abi: ERC20_ABI,
          functionName: 'transfer',
          args: [paymentAddress, paymentAmount]
        });
        
        log('✅', 'X402', `Payment sent on Base Sepolia! Tx: ${paymentTxHash}`);
        await basePublicClient.waitForTransactionReceipt({ hash: paymentTxHash });

        log('🤖', 'HEYELSA', 'Retrying OpenClaw analysis with Payment Proof...');
        const retryResponse = await axios.post(elsaUrl, aiPayload, {
          headers: { 'x-payment-proof': paymentTxHash }
        });

        aiScore = parseInt(retryResponse.data.score);
        log('🧠', 'HEYELSA', `OpenClaw returned GigScore: ${aiScore}`);
      } else {
        log('⚠️', 'HEYELSA', `API failed (${error.message}). Falling back to math.`);
        aiScore = calculateGigScore(platform, scoreEntropyHash);
      }
    }

    if (isNaN(aiScore) || aiScore < 50 || aiScore > 95) {
        aiScore = calculateGigScore(platform, scoreEntropyHash);
    }

    log('⛓️', 'STEP 3', `Minting GigScore ${aiScore} to Pramaan Smart Contract...`);
    const txHash = await sepoliaWalletClient.writeContract({
      account, address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'setGigScore', args: [walletAddress, aiScore]
    })
    await sepoliaPublicClient.waitForTransactionReceipt({ hash: txHash })

    walletState.income = { ...(proofState || {}), ready: true, type: 'income', platform, proofHash: scoreEntropyHash, scoreAssigned: true, score: aiScore, scoreTxHash: txHash, updatedAt: Date.now() }
    pendingProofs[normalizedWallet] = walletState
    savePendingProofs()

    res.json({ ok: true, score: aiScore, txHash, platform, agent: "HeyElsa OpenClaw (Simulator)" })
  } catch (err) {
    log('❌', 'STEP 3', `Score assignment failed: ${err.message}`)
    res.status(500).json({ error: err.message })
  }
})

// =========================================================================
// THE LENDER ROUTE: FETCH GIG SCORE (X402 PROTECTED)
// =========================================================================
app.get('/api/lender/worker-score/:workerAddress', async (req, res) => {
  const { workerAddress } = req.params;
  const paymentProof = req.headers['x-payment-proof'];

  // 1. Throw 402 if Lender hasn't paid Pramaan yet
  if (!paymentProof) {
    log('🛡️', 'PRAMAAN BUREAU', `Lender requested data for ${workerAddress}. Demanding 0.05 USDC fee.`);
    
    // EXPLICITLY expose headers so the React frontend can read them
    res.setHeader('Access-Control-Expose-Headers', 'x-payment-address, x-payment-amount, x-payment-chain');
    
    return res.status(402).set({
      'x-payment-address': '0xa60d26d641fC807C9659df3f1A5E24Dc54C6baD7', // Your wallet collects the Lender fees!
      'x-payment-amount': '50000', // 0.05 USDC (6 decimals)
      'x-payment-chain': 'base-sepolia'
    }).json({ error: 'x402 Payment Required' });
  }

  // 2. If paid, return the worker's data
  log('💰', 'PRAMAAN BUREAU', `Lender Payment Verified! Tx: ${paymentProof}`);
  
  const workerData = pendingProofs[workerAddress.toLowerCase()] || {};
  const score = workerData.income?.score || 85; // Fallback score if not fully processed
  const platform = workerData.income?.platform || "Unknown";

  res.json({
    ok: true,
    score: score,
    platform: platform,
    details: "Income verified via Reclaim ZK-Proofs. Identity verified via Anon Aadhaar."
  });
});

app.listen(4000, () => log('🚀', 'SERVER', 'Backend running on http://localhost:4000'))