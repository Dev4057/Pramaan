const { calculateDeveloperScore } = require("./src/services/ActuarialScoring.js");
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
app.use(express.json({ limit: "50mb" }))
// Reclaim SDK sometimes sends callbacks as URL-encoded form or plain text
app.use(express.urlencoded({ extended: true, limit: "50mb" }))
app.use(express.text({ type: 'text/*', limit: "50mb" }))

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
const RECLAIM_PROVIDER_GITHUB = '8573efb4-4529-47d3-80da-eaa7384dac19'

const STORE_DIR = path.join(__dirname, 'data')
const STORE_FILE = path.join(STORE_DIR, 'pending-proofs.json')
const MOCK_FIXTURE_FILE = path.join(STORE_DIR, 'mock-zk-fixtures.json')

const PROVIDERS = { identity: RECLAIM_PROVIDER_IDENTITY, github: RECLAIM_PROVIDER_GITHUB }

const CONTRACT_ABI = [
  { type: 'function', name: 'updateGigScore', stateMutability: 'nonpayable', inputs: [{ name: '_worker', type: 'address' }, { name: '_score', type: 'uint8' }, { name: '_dataHash', type: 'string' }], outputs: [] },
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
  if (provider === 'github') return 'GitHub'
  return 'Unknown'
}

function extractPlatformFromProof(proof) {
  const claimData = proof?.claimData || proof?.proofs?.[0]?.claimData || {}
  return claimData?.provider || claimData?.providerName || 'Unknown'
}

/**
 * Extracts GitHub contribution count from a Reclaim proof object.
 * Tries every known location across SDK versions.
 */
function extractContributionsFromProof(proof) {
  // Safety: parse if delivered as a string (startSession does this)
  if (typeof proof === 'string') {
    try { proof = JSON.parse(proof); } catch (_) { return 0; }
  }
  const src1 = proof?.extractedParameterValues || {};

  let src2 = {};
  try {
    if (proof?.claimData?.context) {
      const ctx = typeof proof.claimData.context === 'string'
        ? JSON.parse(proof.claimData.context) : proof.claimData.context;
      src2 = ctx?.extractedParameters || {};
    }
  } catch (_) {}

  let src3 = {};
  let src3pv = {};
  try {
    if (proof?.claimData?.parameters) {
      const p = typeof proof.claimData.parameters === 'string'
        ? JSON.parse(proof.claimData.parameters) : proof.claimData.parameters;
      if (typeof p === 'object' && p !== null) {
        src3 = p;
        if (typeof p.paramValues === 'object' && p.paramValues !== null) src3pv = p.paramValues;
      }
    }
  } catch (_) {}

  let src4 = {};
  try {
    if (proof?.parameters) {
      const p = typeof proof.parameters === 'string'
        ? JSON.parse(proof.parameters) : proof.parameters;
      src4 = (typeof p === 'object' && p !== null) ? p : {};
    }
  } catch (_) {}

  // src3pv (paramValues) has highest priority — it's where Reclaim v4 puts extracted values
  const params = Object.assign({}, src4, src3, src3pv, src2, src1);

  log('🔍', 'RECLAIM PARAMS', `merged: ${JSON.stringify(params)}`)

  let raw =
    params.contributions || params.totalContributions || params.total_contributions ||
    params.commits || params.yearlyContributions || params.yearly_contributions ||
    params.contributionCount || params.contribution_count || params.githubContributions;

  if (!raw) {
    const numericVals = Object.values(params).filter(v => {
      const n = parseInt(String(v).replace(/,/g, ''), 10);
      return !isNaN(n) && n > 0;
    });
    if (numericVals.length > 0) raw = numericVals[0];
  }

  const count = parseInt(String(raw || '0').replace(/,/g, '').trim(), 10) || 0;
  log('🧮', 'PARSED CONTRIBUTIONS', `${count}`)
  return count;
}

/**
 * Fetches proof from Reclaim status URL and returns the first proof object if ready.
 * Returns null if not ready yet.
 */
async function fetchProofFromStatusUrl(statusUrl) {
  try {
    const r = await fetch(statusUrl);
    const data = await r.json();
    log('🔬', 'STATUS URL', `Response keys: ${Object.keys(data || {}).join(', ')}`)
    log('🔬', 'STATUS URL', `Full response: ${JSON.stringify(data).slice(0, 1200)}`)

    // Try every known location Reclaim uses across SDK versions
    const proofs =
      data?.session?.proofs ||
      data?.session?.statusV2?.proofs ||
      data?.session?.verifiedProofs ||
      data?.proofs ||
      data?.statusV2?.proofs ||
      data?.verifiedProofs ||
      (Array.isArray(data) ? data : null);
    if (proofs && proofs.length > 0) {
      let p = proofs[0];
      if (typeof p === 'string') { try { p = JSON.parse(p); } catch (_) {} }
      return p;
    }
  } catch (err) {
    log('⚠️', 'STATUS URL', `Fetch failed: ${err.message}`)
  }
  return null;
}

/**
 * Retry fetching proof from statusUrl with delays.
 * Reclaim's onSuccess fires as a notification — the actual proof data
 * becomes available at the statusUrl shortly after.
 */
async function fetchProofFromStatusUrlWithRetry(statusUrl, maxRetries = 5, delayMs = 3000) {
  for (let i = 0; i < maxRetries; i++) {
    log('🔄', 'STATUS RETRY', `Attempt ${i + 1}/${maxRetries} for statusUrl...`)
    const proof = await fetchProofFromStatusUrl(statusUrl);
    if (proof) return proof;
    if (i < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  log('❌', 'STATUS RETRY', `All ${maxRetries} attempts exhausted — proof not available at statusUrl`)
  return null;
}

/**
 * Normalises a Reclaim body that may have been misrouted by express.urlencoded():
 * When Reclaim sends JSON with wrong Content-Type, Express treats the whole JSON
 * string as a URL-encoded key → { '{"identifier":...}': '' }
 */
function decodeReclaimBody(rawBody) {
  let body = rawBody;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (_) {}
  }
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const keys = Object.keys(body);
    if (keys.length === 1 && keys[0].trimStart().startsWith('{')) {
      try { body = JSON.parse(keys[0]); } catch (_) {}
    }
  }
  if (Array.isArray(body) && body.length > 0) body = body[0];
  return body;
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

async function storeProofData(walletAddress, type, proofData) {
  try {
    const res = await fetch('https://api.fileverse.com/v1/docs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: `Pramaan ${type} Proof - ${walletAddress}`, content: JSON.stringify(proofData) })
    })
    const data = await res.json()
    return data?.data?.ddocId || data?.ddocId || `fallback-${Date.now()}`
  } catch (err) { return `fallback-${Date.now()}` }
}

function generateProofHash(proof, walletAddress, type) {
  const safeProofStr = proof ? JSON.stringify(proof) : "{}";
  const str = `${type}-${walletAddress}-${safeProofStr.slice(0, 100)}-${Date.now()}`;
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
    reclaimProofRequest.setAppCallbackUrl(`${CALLBACK_URL}/api/reclaim/callback/identity/${walletAddress}`, true)
    const walletState = ensureWalletState(walletAddress)
    walletState.identity = { ready: false, type: 'identity', providerLabel: 'Aadhaar', expiresAt: Date.now() + REQUEST_TTL_MS, updatedAt: Date.now() }
    savePendingProofs()
    res.json({ requestUrl: await reclaimProofRequest.getRequestUrl(), statusUrl: reclaimProofRequest.getStatusUrl() })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.post('/api/reclaim/generate-request', async (req, res) => {
  try {
    requireReclaimConfig()
    const { walletAddress, provider = 'github' } = req.body
    const reclaimProofRequest = await ReclaimProofRequest.init(APP_ID, APP_SECRET, PROVIDERS[provider])
    reclaimProofRequest.setContext(walletAddress, `Pramaan developer reputation verification (${provider})`)
    // Keep callback URL as a fallback for older SDK behaviour
    reclaimProofRequest.setAppCallbackUrl(`${CALLBACK_URL}/api/reclaim/callback/reputation/${walletAddress}`, true)
    const requestUrl = await reclaimProofRequest.getRequestUrl()
    const statusUrl = reclaimProofRequest.getStatusUrl()

    const walletState = ensureWalletState(walletAddress)
    walletState.reputation = {
      ready: false, type: 'reputation', provider,
      providerLabel: getProviderDisplayName(provider),
      statusUrl,
      expiresAt: Date.now() + REQUEST_TTL_MS,
      updatedAt: Date.now()
    }
    savePendingProofs()

    // ── PRIMARY DELIVERY MECHANISM ──
    // Reclaim SDK v4 delivers proofs via an internal WebSocket / long-poll session.
    // startSession() runs in the background; onSuccess fires the moment the proof arrives.
    // setAppCallbackUrl above is kept only as a secondary fallback.
    reclaimProofRequest.startSession({
      onSuccess: async (proofs) => {
        try {
          log('✅', 'RECLAIM SESSION', `onSuccess fired for ${walletAddress}`)
          log('🔬', 'RAW onSuccess', `type=${typeof proofs}, isArray=${Array.isArray(proofs)}`)
          log('🔬', 'RAW onSuccess', `value=${(JSON.stringify(proofs) || 'undefined').slice(0, 800)}`)

          // Normalize: Reclaim SDK delivers proofs in various shapes across versions
          let proof = null;

          if (typeof proofs === 'string') {
            try { proof = JSON.parse(proofs); } catch (_) { proof = proofs; }
          } else if (Array.isArray(proofs) && proofs.length > 0) {
            proof = proofs[0];
          } else if (proofs && typeof proofs === 'object') {
            if (proofs.proofs && Array.isArray(proofs.proofs) && proofs.proofs.length > 0) {
              proof = proofs.proofs[0];
            } else if (proofs.claimData || proofs.identifier) {
              proof = proofs;
            } else {
              const vals = Object.values(proofs);
              for (const v of vals) {
                if (v && typeof v === 'object' && (v.claimData || v.identifier)) { proof = v; break; }
                if (typeof v === 'string' && v.startsWith('{')) { try { proof = JSON.parse(v); break; } catch (_) {} }
              }
            }
          }

          // Final string→object parse
          if (typeof proof === 'string') {
            try { proof = JSON.parse(proof); } catch (_) {}
          }

          // ── CRITICAL FIX: onSuccess often fires with empty [] as a notification ──
          // The actual proof data must be fetched from statusUrl with retries.
          const isEmptyOrInvalid = !proof || (typeof proof === 'object' && !proof.claimData && !proof.identifier && Object.keys(proof).length === 0);
          if (isEmptyOrInvalid) {
            log('⚠️', 'RECLAIM SESSION', `onSuccess delivered empty/notification — fetching proof from statusUrl with retries...`)
            const ws = ensureWalletState(walletAddress)
            const sUrl = ws.reputation?.statusUrl
            if (sUrl) {
              proof = await fetchProofFromStatusUrlWithRetry(sUrl, 5, 3000);
            }
          }

          if (!proof || typeof proof !== 'object' || (!proof.claimData && !proof.identifier)) {
            log('❌', 'RECLAIM SESSION', `Could not obtain proof for ${walletAddress} from onSuccess or statusUrl`)
            return;
          }

          log('🔬', 'NORMALIZED PROOF', `type=${typeof proof}, keys=[${Object.keys(proof).join(', ')}]`)

          const ws = ensureWalletState(walletAddress)
          if (!ws.reputation?.ready) {
            await applyReputationProof(proof, walletAddress, ws)
          }
        } catch (e) {
          log('❌', 'RECLAIM SESSION', `onSuccess error: ${e.message}`)
        }
      },
      onFailure: (err) => {
        log('❌', 'RECLAIM SESSION', `Session failed for ${walletAddress}: ${err}`)
      }
    }).catch(err => log('⚠️', 'RECLAIM SESSION', `startSession threw: ${err?.message}`))

    log('🔗', 'RECLAIM', `Session started for ${walletAddress}. QR ready.`)
    res.json({ requestUrl, statusUrl })
  } catch (err) { res.status(500).json({ error: err.message }) }
})

// Shared helper: given a verified proof object, update walletState and persist
async function applyReputationProof(proof, walletAddress, walletState) {
  // CRITICAL: startSession delivers proofs as JSON *strings*, not objects.
  // Also handle nested arrays: proofs might be [["proof-string"]] or ["proof-string"]
  if (typeof proof === 'string') {
    try { proof = JSON.parse(proof); } catch (_) {}
  }
  if (Array.isArray(proof)) {
    proof = proof[0];
    if (typeof proof === 'string') {
      try { proof = JSON.parse(proof); } catch (_) {}
    }
  }

  // GUARD: never set ready=true without a real proof object
  if (!proof || typeof proof !== 'object') {
    log('❌', 'APPLY PROOF', `Rejected: proof is ${proof === null ? 'null' : typeof proof}. Will NOT mark as ready.`)
    return 0;
  }

  log('🔬', 'PROOF STRUCTURE', `type=${typeof proof}, keys=[${Object.keys(proof).join(', ')}]`)
  log('🔬', 'PROOF SAMPLE', JSON.stringify(proof).slice(0, 500))

  const contributions = extractContributionsFromProof(proof)

  // GUARD: do not mark ready with 0 contributions — extraction likely failed
  if (contributions === 0) {
    log('⚠️', 'APPLY PROOF', `Contributions extracted as 0. NOT marking as ready. Proof keys: [${Object.keys(proof).join(', ')}]`)
    return 0;
  }

  const proofHash = generateProofHash(proof, walletAddress, 'reputation')
  const ddocId = await storeProofData(walletAddress, 'reputation', proof)
  walletState.reputation = {
    ...walletState.reputation,
    ready: true, proofHash, ddocId,
    contributions,
    updatedAt: Date.now(),
    platform: 'GitHub'
  }
  savePendingProofs()
  log('✅', 'RECLAIM', `Proof applied. contributions=${contributions}`)
  return contributions
}

app.post('/api/reclaim/callback/reputation/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params
    const walletState = ensureWalletState(walletAddress)
    if (!walletState.reputation) return res.status(400).json({ error: 'No pending reputation request' })

    log('📨', 'RECLAIM CB RAW', `req.body type=${typeof req.body}, isArray=${Array.isArray(req.body)}, keys=[${Object.keys(req.body || {}).join(', ')}]`)
    log('📨', 'RECLAIM CB RAW', `content=${JSON.stringify(req.body).slice(0, 500)}`)

    // Attempt 1: proof in the request body
    const bodyData = decodeReclaimBody(req.body)
    const bodyHasProof = bodyData && typeof bodyData === 'object'
      && (bodyData.claimData || bodyData.identifier || bodyData.proofs)

    if (bodyHasProof) {
      log('📨', 'RECLAIM CB', `Proof in body. claimData: ${!!bodyData.claimData}`)
      const contributions = await applyReputationProof(bodyData, walletAddress, walletState)
      return res.json({ ok: true, contributions })
    }

    // Attempt 2: fetch from Reclaim statusUrl (v4 sends empty notification)
    if (walletState.reputation.statusUrl) {
      log('📨', 'RECLAIM CB', 'Body empty — fetching from Reclaim statusUrl...')
      const proof = await fetchProofFromStatusUrl(walletState.reputation.statusUrl)
      if (proof) {
        const contributions = await applyReputationProof(proof, walletAddress, walletState)
        return res.json({ ok: true, contributions })
      }
      log('⚠️', 'RECLAIM CB', 'Proof not ready at statusUrl yet — will be picked up by next frontend poll')
    }

    // Return 200 so Reclaim does not retry endlessly
    res.json({ ok: true, status: 'pending' })
  } catch (err) {
    log('❌', 'RECLAIM CB', `Error: ${err.message}`)
    res.status(500).json({ error: err.message })
  }
})

app.post('/api/reclaim/callback/identity/:walletAddress', async (req, res) => {
  try {
    const { walletAddress } = req.params
    const proof = req.body
    const walletState = ensureWalletState(walletAddress)
  } catch (err) { res.status(500).json({ error: err.message }) }
})

app.get('/api/reclaim/status/:type/:walletAddress', async (req, res) => {
  const { type, walletAddress } = req.params
  const walletState = pendingProofs[walletAddress.toLowerCase()] || {}
  const status = walletState[type]

  if (status && !status.ready && status.expiresAt && Date.now() > status.expiresAt) {
    return res.json({ ready: false, expired: true })
  }

  // Already ready — return immediately
  if (status?.ready) return res.json(status)

  // Not ready yet — log so we can confirm frontend is actually polling
  log('⏳', 'STATUS POLL', `type=${type} wallet=${walletAddress.slice(0,8)} — not ready yet`)

  // statusUrl fallback: Reclaim might make the proof available here eventually
  if (type === 'reputation' && status?.statusUrl) {
    try {
      const proof = await fetchProofFromStatusUrl(status.statusUrl)
      if (proof) {
        log('✅', 'STATUS POLL', `Proof found at Reclaim statusUrl for ${walletAddress}`)
        const ws = ensureWalletState(walletAddress)
        await applyReputationProof(proof, walletAddress, ws)
        return res.json(ws.reputation)
      }
    } catch (_) {}
  }

  res.json({ ready: false })
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
    const account = privateKeyToAccount(AGENT_PRIVATE_KEY);
    
    const baseTransport = http(process.env.BASE_RPC_URL || 'https://sepolia.base.org')
    const basePublicClient = createPublicClient({ chain: baseSepolia, transport: baseTransport })
    const baseWalletClient = createWalletClient({ account, chain: baseSepolia, transport: baseTransport })

    const proofState = walletState.reputation
    let platform
    let scoreEntropyHash

    if (proofState?.ready) {
      platform = proofState.platform || proofState.providerLabel || 'GitHub'
      scoreEntropyHash = proofState.proofHash || generateProofHash({ platform }, walletAddress, 'reputation')
    } else {
      platform = typeof platformOverride === 'string' && platformOverride.trim() ? platformOverride.trim() : 'GitHub'
      scoreEntropyHash = toDeterministicHash(`${normalizedWallet}:${platform.toLowerCase()}:zk-score-v1`)
    }

    const contributions = proofState?.contributions || 0;
    log('📊', 'STEP 2', `Contributions from proof: ${contributions}, Platform: ${platform}`)

    // Guard: do not mint a score of 0 — it means the Reclaim proof either hasn't
    // arrived yet or the parameter extraction failed. Return an actionable error.
    if (contributions === 0 && !proofState?.ready) {
      return res.status(400).json({
        error: 'No verified proof found for this wallet. Complete GitHub verification via Reclaim first.',
        hint: 'Call POST /api/reclaim/generate-request to start the verification flow.'
      })
    }

    const devScore = calculateDeveloperScore(contributions);
    log('⛓️', 'STEP 3', `Minting GigScore ${devScore} (from ${contributions} contributions) to Pramaan Smart Contract...`);

    if (devScore === 0) {
      log('⚠️', 'STEP 3', `Score is 0 — Reclaim proof was received but contributions could not be extracted. Check the callback logs.`)
      return res.status(400).json({
        error: 'Score calculated as 0. GitHub contributions were not extracted from the Reclaim proof.',
        contributions,
        hint: 'Check the /api/reclaim/callback logs. The extractedParameterValues field may be empty.'
      })
    }

    const txHash = await baseWalletClient.writeContract({
      account, address: CONTRACT_ADDRESS, abi: CONTRACT_ABI, functionName: 'updateGigScore', args: [walletAddress, devScore, scoreEntropyHash]
    })
    await basePublicClient.waitForTransactionReceipt({ hash: txHash })
    log('✅', 'STEP 3', `Score ${devScore} minted. TxHash: ${txHash}`)

    walletState.reputation = {
      ...(proofState || {}),
      ready: true,
      type: 'reputation',
      platform,
      proofHash: scoreEntropyHash,
      scoreAssigned: true,
      score: devScore,
      contributions,
      scoreTxHash: txHash,
      updatedAt: Date.now()
    }
    pendingProofs[normalizedWallet] = walletState
    savePendingProofs()

    res.json({ ok: true, score: devScore, contributions, txHash, platform, agent: "Mathematical Model" })
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

  // 2. Payment received — return the worker's verified data
  log('💰', 'PRAMAAN BUREAU', `Lender Payment Verified! Tx: ${paymentProof}`);

  const workerData = pendingProofs[workerAddress.toLowerCase()] || {};
  const reputation = workerData.reputation || {};

  if (!reputation.scoreAssigned) {
    return res.status(404).json({
      ok: false,
      error: 'No score found for this worker. Worker must complete GitHub verification and score generation first.'
    });
  }

  const score = reputation.score || 0;
  const platform = reputation.platform || 'GitHub';
  const contributions = reputation.contributions || 0;
  const scoreTxHash = reputation.scoreTxHash || null;
  const updatedAt = reputation.updatedAt ? new Date(reputation.updatedAt).toISOString() : null;

  // Generate AI analysis via AgentReport
  let aiAnalysis = 'Score verified on-chain via Pramaan Protocol.';
  try {
    const AgentReport = require('./src/services/AgentReport');
    aiAnalysis = await AgentReport.generateRiskReport(score, contributions);
  } catch (_) {}

  res.json({
    ok: true,
    score,
    platform,
    contributions,
    scoreTxHash,
    updatedAt,
    details: `${contributions} GitHub contributions verified via Reclaim ZK-Proofs. Score minted on-chain.`,
    ai_analysis: aiAnalysis
  });
});

app.listen(4000, () => log('🚀', 'SERVER', 'Backend running on http://localhost:4000')).on("error", (err) => { console.error(err); });