require('dotenv').config()
const express = require('express')
const cors = require('cors')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { ReclaimProofRequest } = require('@reclaimprotocol/js-sdk')
const { createPublicClient, createWalletClient, http, isAddress } = require('viem')
const { privateKeyToAccount } = require('viem/accounts')

const app = express()
app.use(cors())
app.use(express.json())

// --- Logging helper ---
function log(emoji, tag, msg) {
  const ts = new Date().toLocaleTimeString()
  console.log(`${ts} ${emoji} [${tag}] ${msg}`)
}

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

// Provider IDs
const PROVIDERS = {
  identity: RECLAIM_PROVIDER_IDENTITY,
  sbi: RECLAIM_PROVIDER_SBI,
  uber: RECLAIM_PROVIDER_UBER
}

const CONTRACT_ABI = [
  {
    type: 'function',
    name: 'setGigScore',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_worker', type: 'address' },
      { name: '_score', type: 'uint8' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'isVerified',
    stateMutability: 'view',
    inputs: [{ name: '_worker', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }]
  }
]

let pendingProofs = loadPendingProofs()
let mockFixtures = loadMockFixtures()

function ensureWalletState(walletAddress) {
  const key = walletAddress.toLowerCase()
  if (!pendingProofs[key]) {
    pendingProofs[key] = {}
  }
  return pendingProofs[key]
}

function loadPendingProofs() {
  try {
    if (!fs.existsSync(STORE_FILE)) return {}
    const raw = fs.readFileSync(STORE_FILE, 'utf8')
    if (!raw.trim()) return {}
    return JSON.parse(raw)
  } catch (err) {
    log('⚠️', 'STORE', `Failed to read pending proof store: ${err.message}`)
    return {}
  }
}

function loadMockFixtures() {
  try {
    if (!fs.existsSync(MOCK_FIXTURE_FILE)) return { default: null, workers: {} }
    const raw = fs.readFileSync(MOCK_FIXTURE_FILE, 'utf8')
    if (!raw.trim()) return { default: null, workers: {} }
    const parsed = JSON.parse(raw)
    return {
      default: parsed.default || null,
      workers: parsed.workers || {}
    }
  } catch (err) {
    log('⚠️', 'MOCK-ZK', `Failed to load mock fixtures: ${err.message}`)
    return { default: null, workers: {} }
  }
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
  const digest = /^[0-9a-fA-F]{64}$/.test(hexOrText)
    ? hexOrText.toLowerCase()
    : toDeterministicHash(hexOrText)
  return `0x${digest}`
}

function addressToUint256Hex(walletAddress) {
  return `0x${walletAddress.toLowerCase().replace('0x', '').padStart(64, '0')}`
}

function buildIdentityProofPack(walletAddress, profile) {
  const payload = {
    ageAbove18: true,
    country: 'IN',
    fixture: profile?.fixtureId || 'default'
  }
  const nullifier = hashToUint256(JSON.stringify({ walletAddress: walletAddress.toLowerCase(), type: 'identity-nullifier' }))
  const commitment = hashToUint256(JSON.stringify({ walletAddress: walletAddress.toLowerCase(), payload, salt: 'identity-v1' }))
  const ddocId = `mockzk:identity:${walletAddress.toLowerCase()}`
  const publicSignals = [
    addressToUint256Hex(walletAddress),
    '0x1',
    '0x1',
    nullifier,
    commitment
  ]

  return {
    proof: '0x01',
    publicSignals,
    ddocId,
    platform: 'Aadhaar',
    payload
  }
}

function buildIncomeProofPack(walletAddress, provider, incomePayload) {
  const platformCode = provider === 'uber' ? '0x2' : '0x1'
  const nullifier = hashToUint256(JSON.stringify({ walletAddress: walletAddress.toLowerCase(), type: `income-nullifier:${provider}` }))
  const commitment = hashToUint256(JSON.stringify({ walletAddress: walletAddress.toLowerCase(), provider, incomePayload, salt: 'income-v1' }))
  const ddocId = `mockzk:income:${provider}:${walletAddress.toLowerCase()}`
  const publicSignals = [
    addressToUint256Hex(walletAddress),
    '0x1',
    platformCode,
    nullifier,
    commitment
  ]

  return {
    proof: '0x01',
    publicSignals,
    ddocId,
    platform: provider === 'uber' ? 'Uber' : 'SBI',
    payload: incomePayload
  }
}

function savePendingProofs() {
  try {
    if (!fs.existsSync(STORE_DIR)) {
      fs.mkdirSync(STORE_DIR, { recursive: true })
    }
    fs.writeFileSync(STORE_FILE, JSON.stringify(pendingProofs, null, 2), 'utf8')
  } catch (err) {
    log('⚠️', 'STORE', `Failed to persist pending proofs: ${err.message}`)
  }
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

function calculateGigScore(platform, proofHash) {
  const normalized = (platform || '').toLowerCase()
  const base = normalized.includes('sbi') ? 72 : normalized.includes('uber') ? 68 : 62
  const entropy = Number.parseInt((proofHash || '0').slice(0, 8), 16) || 0
  const drift = entropy % 13
  return Math.min(95, Math.max(50, base + drift))
}

function getAgentClients() {
  if (!RPC_URL) throw new Error('RPC_URL is not configured in backend .env')
  if (!CONTRACT_ADDRESS || !isAddress(CONTRACT_ADDRESS)) {
    throw new Error('CONTRACT_ADDRESS is missing or invalid in backend .env')
  }
  if (!AGENT_PRIVATE_KEY) throw new Error('AGENT_PRIVATE_KEY is not configured in backend .env')

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
  } catch (_) {
    return false
  }
}

function requireReclaimConfig() {
  if (!APP_ID || !APP_SECRET) {
    throw new Error('RECLAIM_APP_ID/RECLAIM_APP_SECRET are missing in backend .env')
  }
}

// --- Helper: Store proof in Fileverse ---
async function storeInFileverse(walletAddress, proofData, type) {
  try {
    const res = await fetch(`${FILEVERSE_URL}/api/ddocs?apiKey=${FILEVERSE_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        title: `Pramaan ${type} Proof - ${walletAddress}`,
        content: JSON.stringify(proofData)
      })
    })
    const data = await res.json()
    console.log('Fileverse response:', data)
    return data?.data?.ddocId || data?.ddocId || `fallback-${Date.now()}`
  } catch (err) {
    console.error('Fileverse storage error:', err)
    return `fallback-${Date.now()}`
  }
}

// --- Helper: Generate proof hash ---
function generateProofHash(proof, walletAddress, type) {
  const str = `${type}-${walletAddress}-${JSON.stringify(proof).slice(0, 100)}-${Date.now()}`
  return Buffer.from(str).toString('hex').slice(0, 64)
}

app.get('/health', (_, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() })
})

app.get('/api/reclaim/preflight', async (_, res) => {
  const callbackHealthy = await isCallbackHealthy()
  res.json({
    ok: !!APP_ID && !!APP_SECRET,
    reclaimConfigured: !!APP_ID && !!APP_SECRET,
    callbackHealthy,
    callbackUrl: CALLBACK_URL,
    mockZkEnabled: ENABLE_MOCK_ZK,
    zkFlowEnabled: ENABLE_ZK_FLOW
  })
})

app.post('/api/zk/identity-proof/:walletAddress', (req, res) => {
  const { walletAddress } = req.params
  if (!ENABLE_ZK_FLOW) return res.status(403).json({ error: 'ZK flow is disabled' })
  if (!ENABLE_MOCK_ZK) return res.status(400).json({ error: 'ZK proof-pack endpoint currently requires ENABLE_MOCK_ZK=true' })
  if (!isAddress(walletAddress)) return res.status(400).json({ error: 'Invalid wallet address' })

  const profile = getMockWorkerProfile(walletAddress)
  if (!profile) return res.status(404).json({ error: 'No mock fixture found for wallet' })
  if (!profile.ageAbove18 || profile.country !== 'IN') {
    return res.status(400).json({ error: 'Mock fixture does not satisfy identity checks' })
  }

  const pack = buildIdentityProofPack(walletAddress, profile)
  return res.json({ ok: true, mode: 'mock-zk', ...pack })
})

app.post('/api/zk/income-proof/:walletAddress', (req, res) => {
  const { walletAddress } = req.params
  const { provider = 'sbi' } = req.body || {}

  if (!ENABLE_ZK_FLOW) return res.status(403).json({ error: 'ZK flow is disabled' })
  if (!ENABLE_MOCK_ZK) return res.status(400).json({ error: 'ZK proof-pack endpoint currently requires ENABLE_MOCK_ZK=true' })
  if (!isAddress(walletAddress)) return res.status(400).json({ error: 'Invalid wallet address' })
  if (!['sbi', 'uber'].includes(provider)) return res.status(400).json({ error: 'Unsupported provider for ZK flow' })

  const profile = getMockWorkerProfile(walletAddress)
  if (!profile) return res.status(404).json({ error: 'No mock fixture found for wallet' })
  const incomePayload = profile?.income?.[provider]
  if (!incomePayload) return res.status(400).json({ error: `No mock ${provider.toUpperCase()} income fixture for wallet` })

  const pack = buildIncomeProofPack(walletAddress, provider, incomePayload)
  return res.json({ ok: true, mode: 'mock-zk', ...pack })
})

app.get('/api/mock/profile/:walletAddress', (req, res) => {
  const { walletAddress } = req.params
  if (!isAddress(walletAddress)) return res.status(400).json({ error: 'Invalid wallet address' })
  const profile = getMockWorkerProfile(walletAddress)
  if (!ENABLE_MOCK_ZK) return res.status(403).json({ error: 'Mock ZK mode is disabled' })
  if (!profile) return res.status(404).json({ error: 'No mock fixture found for wallet' })
  res.json({ ok: true, profile })
})

app.post('/api/mock/identity-verify/:walletAddress', (req, res) => {
  const { walletAddress } = req.params
  if (!ENABLE_MOCK_ZK) return res.status(403).json({ error: 'Mock ZK mode is disabled' })
  if (!isAddress(walletAddress)) return res.status(400).json({ error: 'Invalid wallet address' })

  const profile = getMockWorkerProfile(walletAddress)
  if (!profile) return res.status(404).json({ error: 'No mock fixture found for wallet' })
  if (!profile.ageAbove18 || profile.country !== 'IN') {
    return res.status(400).json({ error: 'Mock fixture does not satisfy identity checks' })
  }

  const payload = { ageAbove18: true, country: 'IN' }
  const proofHash = buildMockProofHash(walletAddress, 'identity', payload)
  const ddocId = `mockzk:identity:${walletAddress.toLowerCase()}`
  res.json({ ok: true, ddocId, proofHash, payload })
})

app.post('/api/mock/income-verify/:walletAddress', (req, res) => {
  const { walletAddress } = req.params
  const { provider = 'sbi' } = req.body || {}

  if (!ENABLE_MOCK_ZK) return res.status(403).json({ error: 'Mock ZK mode is disabled' })
  if (!isAddress(walletAddress)) return res.status(400).json({ error: 'Invalid wallet address' })
  if (!['sbi', 'uber'].includes(provider)) return res.status(400).json({ error: 'Unsupported provider for mock mode' })

  const profile = getMockWorkerProfile(walletAddress)
  if (!profile) return res.status(404).json({ error: 'No mock fixture found for wallet' })

  const incomePayload = profile?.income?.[provider]
  if (!incomePayload) return res.status(400).json({ error: `No mock ${provider.toUpperCase()} income fixture for wallet` })

  const proofHash = buildMockProofHash(walletAddress, 'income', { provider, incomePayload })
  const ddocId = `mockzk:income:${provider}:${walletAddress.toLowerCase()}`
  const platform = provider === 'uber' ? 'Uber' : 'SBI'

  res.json({ ok: true, ddocId, proofHash, platform, payload: incomePayload })
})

// --- Route: Generate identity request ---
app.post('/api/reclaim/identity-request', async (req, res) => {
  try {
    requireReclaimConfig()
    const { walletAddress } = req.body
    if (!walletAddress) return res.status(400).json({ error: 'walletAddress required' })
    if (!isAddress(walletAddress)) return res.status(400).json({ error: 'Invalid wallet address' })

    const callbackHealthy = await isCallbackHealthy()
    if (!callbackHealthy) {
      return res.status(503).json({
        error: 'Callback URL is not reachable. Keep backend/ngrok running and retry.'
      })
    }

    log('📋', 'STEP 1', `Identity request from wallet: ${walletAddress}`)
    if (!PROVIDERS.identity) {
      return res.status(400).json({ error: 'Identity provider ID is not configured in backend .env' })
    }
    log('🔧', 'STEP 1', `Initializing Reclaim SDK with provider: ${PROVIDERS.identity}`)

    const reclaimProofRequest = await ReclaimProofRequest.init(
      APP_ID,
      APP_SECRET,
      PROVIDERS.identity
    )

    reclaimProofRequest.setContext(walletAddress, 'Pramaan identity verification')

    const callbackUrl = `${CALLBACK_URL}/api/reclaim/callback/identity/${walletAddress}`
    reclaimProofRequest.setAppCallbackUrl(callbackUrl)
    log('🔗', 'STEP 1', `Callback URL set: ${callbackUrl}`)

    const requestUrl = await reclaimProofRequest.getRequestUrl()
    const statusUrl = reclaimProofRequest.getStatusUrl()

    const walletState = ensureWalletState(walletAddress)
    walletState.identity = {
      ready: false,
      type: 'identity',
      providerLabel: 'Aadhaar',
      expiresAt: Date.now() + REQUEST_TTL_MS,
      updatedAt: Date.now()
    }
    savePendingProofs()

    log('✅', 'STEP 1', `QR code generated! Request URL: ${requestUrl}`)
    log('⏳', 'STEP 1', 'Waiting for user to scan QR code on phone...')
    log('📱', 'STEP 1', 'User should: Scan QR → Open link → Login to DigiLocker → Authorize')
    console.log('─'.repeat(60))

    res.json({ requestUrl, statusUrl })
  } catch (err) {
    const errText = String(err?.message || err || '')
    if (/provider id does not exist/i.test(errText)) {
      return res.status(400).json({ error: 'Configured identity provider ID is invalid. Update RECLAIM_PROVIDER_IDENTITY in backend .env' })
    }
    log('❌', 'STEP 1', `Request error: ${err.message}`)
    res.status(500).json({ error: err.message })
  }
})

// --- Route: Generate income request ---
app.post('/api/reclaim/generate-request', async (req, res) => {
  try {
    requireReclaimConfig()
    const { walletAddress, provider } = req.body
    if (!walletAddress || !provider) return res.status(400).json({ error: 'walletAddress and provider required' })
    if (!isAddress(walletAddress)) return res.status(400).json({ error: 'Invalid wallet address' })

    const callbackHealthy = await isCallbackHealthy()
    if (!callbackHealthy) {
      return res.status(503).json({
        error: 'Callback URL is not reachable. Keep backend/ngrok running and retry.'
      })
    }

    const providerId = PROVIDERS[provider]
    if (!providerId) {
      return res.status(400).json({
        error: `${provider.toUpperCase()} provider is unavailable. Configure RECLAIM_PROVIDER_${provider.toUpperCase()} in backend .env or use another provider.`
      })
    }

    const reclaimProofRequest = await ReclaimProofRequest.init(APP_ID, APP_SECRET, providerId)
    reclaimProofRequest.setContext(walletAddress, `Pramaan income verification (${provider})`)
    
    const callbackUrl = `${CALLBACK_URL}/api/reclaim/callback/income/${walletAddress}`
    reclaimProofRequest.setAppCallbackUrl(callbackUrl)

    const requestUrl = await reclaimProofRequest.getRequestUrl()
    const statusUrl = reclaimProofRequest.getStatusUrl()

    const walletState = ensureWalletState(walletAddress)
    walletState.income = {
      ready: false,
      type: 'income',
      provider,
      providerLabel: getProviderDisplayName(provider),
      expiresAt: Date.now() + REQUEST_TTL_MS,
      updatedAt: Date.now()
    }
    savePendingProofs()

    res.json({ requestUrl, statusUrl })
  } catch (err) {
    const errText = String(err?.message || err || '')
    if (/provider id does not exist/i.test(errText)) {
      return res.status(400).json({
        error: 'Configured provider ID does not exist in Reclaim. Update the provider ID in backend .env.'
      })
    }
    res.status(500).json({ error: err.message })
  }
})

// --- Route: Callback for Reclaim (Income) ---
app.post('/api/reclaim/callback/income/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params
    const proof = req.body

    const normalizedWallet = walletAddress.toLowerCase()
    const platformStr = extractPlatformFromProof(proof)
    const ddocId = await storeInFileverse(walletAddress, proof, 'income')
    const proofHash = generateProofHash(proof, walletAddress, 'income')

    const walletState = ensureWalletState(walletAddress)
    walletState.income = {
      ready: true,
      type: 'income',
      platform: platformStr,
      ddocId,
      proofHash,
      updatedAt: Date.now()
    }
    savePendingProofs()

    log('✅', 'STEP 2', `Income proof callback received for ${walletAddress}`)

    res.sendStatus(200)
  } catch (err) {
    console.error('Callback error:', err)
    res.sendStatus(500)
  }
})

app.post('/api/reclaim/callback/identity/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params
    const proof = req.body

    const ddocId = await storeInFileverse(walletAddress, proof, 'identity')
    const proofHash = generateProofHash(proof, walletAddress, 'identity')

    const walletState = ensureWalletState(walletAddress)
    walletState.identity = {
      ready: true,
      type: 'identity',
      platform: 'Aadhaar',
      ddocId,
      proofHash,
      updatedAt: Date.now()
    }
    savePendingProofs()

    log('✅', 'STEP 1', `Identity proof callback received for ${walletAddress}`)
    res.sendStatus(200)
  } catch (err) {
    log('❌', 'STEP 1', `Identity callback error: ${err.message}`)
    res.sendStatus(500)
  }
})

// --- Route: Status poll for income proof ---
app.get('/api/reclaim/status/income/:walletAddress', (req, res) => {
  const { walletAddress } = req.params
  const walletState = pendingProofs[walletAddress.toLowerCase()] || {}
  const status = walletState.income
  if (status && !status.ready && status.expiresAt && Date.now() > status.expiresAt) {
    return res.json({ ready: false, expired: true })
  }
  if (status && status.ready) {
    res.json(status)
  } else {
    res.json({ ready: false })
  }
})

app.get('/api/reclaim/status/identity/:walletAddress', (req, res) => {
  const { walletAddress } = req.params
  const walletState = pendingProofs[walletAddress.toLowerCase()] || {}
  const status = walletState.identity
  if (status && !status.ready && status.expiresAt && Date.now() > status.expiresAt) {
    return res.json({ ready: false, expired: true })
  }
  if (status && status.ready) {
    res.json(status)
  } else {
    res.json({ ready: false })
  }
})

app.post('/api/agent/score/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params
    const { platform: platformOverride } = req.body || {}
    if (!isAddress(walletAddress)) {
      return res.status(400).json({ error: 'Invalid worker wallet address' })
    }

    const normalizedWallet = walletAddress.toLowerCase()
    const walletState = pendingProofs[normalizedWallet] || {}
    const { publicClient, walletClient, account } = getAgentClients()
    const proofState = walletState.income

    let platform
    let scoreEntropyHash

    if (proofState?.ready) {
      platform = proofState.platform || proofState.providerLabel || 'Unknown'
      scoreEntropyHash = proofState.proofHash || generateProofHash({ platform }, walletAddress, 'income')
    } else {
      if (!ENABLE_ZK_FLOW) {
        return res.status(400).json({ error: 'Income proof not completed yet' })
      }

      const isVerified = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'isVerified',
        args: [walletAddress]
      })

      if (!isVerified) {
        return res.status(400).json({ error: 'ZK identity/income verification not finalized on-chain yet' })
      }

      platform = typeof platformOverride === 'string' && platformOverride.trim()
        ? platformOverride.trim()
        : 'SBI'
      scoreEntropyHash = toDeterministicHash(`${normalizedWallet}:${platform.toLowerCase()}:zk-score-v1`)
    }

    const score = calculateGigScore(platform, scoreEntropyHash)

    const txHash = await walletClient.writeContract({
      account,
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: 'setGigScore',
      args: [walletAddress, score]
    })

    await publicClient.waitForTransactionReceipt({ hash: txHash })

    walletState.income = {
      ...(proofState || {}),
      ready: true,
      type: 'income',
      platform,
      proofHash: scoreEntropyHash,
      scoreAssigned: true,
      score,
      scoreTxHash: txHash,
      updatedAt: Date.now()
    }
    pendingProofs[normalizedWallet] = walletState
    savePendingProofs()

    res.json({
      ok: true,
      score,
      txHash,
      platform
    })
  } catch (err) {
    log('❌', 'STEP 3', `Score assignment failed: ${err.message}`)
    res.status(500).json({ error: err.message })
  }
})

// --- Endpoint for storing fallback proofs ---
app.post('/api/store-proof', async (req, res) => {
  try {
    const { walletAddress, proofData, type } = req.body
    const ddocId = await storeInFileverse(walletAddress, proofData, type)
    res.json({ ddocId })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

app.listen(4000, () => {
  log('🚀', 'SERVER', 'Backend running on http://localhost:4000')
})
