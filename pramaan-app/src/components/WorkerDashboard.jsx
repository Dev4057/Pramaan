import { useState, useEffect } from 'react'
import { useAccount, useWriteContract, usePublicClient } from 'wagmi'
import { QRCode } from 'react-qr-code'
import { LogInWithAnonAadhaar, useAnonAadhaar, useProver } from '@anon-aadhaar/react'
import PramaanABI from '../abi/Pramaan.json'

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000'
const USE_TEST_AADHAAR = import.meta.env.VITE_USE_TEST_AADHAAR === 'true'
const ANON_NULLIFIER_SEED = import.meta.env.VITE_ANON_NULLIFIER_SEED || '1234'
const ENABLE_UBER_PROVIDER = import.meta.env.VITE_ENABLE_UBER_PROVIDER === 'true'
const USE_MOCK_ZK = import.meta.env.VITE_USE_MOCK_ZK === 'true'
const USE_ZK_SUBMISSION = import.meta.env.VITE_USE_ZK_SUBMISSION === 'true'
const ENABLE_MOCK_IDENTITY_BUTTON = import.meta.env.VITE_ENABLE_MOCK_IDENTITY_BUTTON === 'true'
const EXPLORER_TX_BASE_URL = import.meta.env.VITE_EXPLORER_TX_BASE_URL || 'https://sepolia.etherscan.io/tx/'
const IDENTITY_ZK_SELECTOR = '8b4b517d'
const INCOME_ZK_SELECTOR = '227ac1a0'

const ZK_METHOD_ABI = [
  {
    type: 'function',
    name: 'submitIdentityZK',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'proof', type: 'bytes' },
      { name: 'publicSignals', type: 'uint256[]' },
      { name: '_ddocId', type: 'string' }
    ],
    outputs: []
  },
  {
    type: 'function',
    name: 'submitIncomeZK',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'proof', type: 'bytes' },
      { name: 'publicSignals', type: 'uint256[]' },
      { name: '_ddocId', type: 'string' },
      { name: '_platform', type: 'string' }
    ],
    outputs: []
  }
]

const WORKER_GETTER_ABI = [
  {
    type: 'function',
    name: 'workers',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'address' }],
    outputs: [
      { name: 'identityVerified', type: 'bool' },
      { name: 'incomeVerified', type: 'bool' },
      { name: 'gigScore', type: 'uint8' },
      { name: 'lastUpdated', type: 'uint256' },
      { name: 'identityDdocId', type: 'string' },
      { name: 'incomeDdocId', type: 'string' },
      { name: 'platform', type: 'string' },
      { name: 'identityProofHash', type: 'string' },
      { name: 'incomeProofHash', type: 'string' },
      { name: 'identityNullifier', type: 'bytes32' },
      { name: 'incomeNullifier', type: 'bytes32' },
      { name: 'identityCommitment', type: 'bytes32' },
      { name: 'incomeCommitment', type: 'bytes32' },
      { name: 'exists', type: 'bool' }
    ]
  }
]

function normalizeWorkerProfile(profile) {
  if (!profile) return null

  if (Array.isArray(profile)) {
    const hasExtendedLayout = profile.length >= 14
    if (hasExtendedLayout) {
      return {
        identityVerified: Boolean(profile[0]),
        incomeVerified: Boolean(profile[1]),
        gigScore: Number(profile[2] || 0),
        platform: profile[7] || '',
        identityDdocId: profile[5] || '',
        incomeDdocId: profile[6] || ''
      }
    }

    return {
      identityVerified: Boolean(profile[0]),
      incomeVerified: Boolean(profile[1]),
      gigScore: Number(profile[2] || 0),
      platform: profile[6] || '',
      identityDdocId: profile[4] || '',
      incomeDdocId: profile[5] || ''
    }
  }

  if (profile && typeof profile === 'object') {
    return {
      identityVerified: Boolean(profile.identityVerified),
      incomeVerified: Boolean(profile.incomeVerified),
      gigScore: Number(profile.gigScore || 0),
      platform: profile.platform || '',
      identityDdocId: profile.identityDdocId || '',
      incomeDdocId: profile.incomeDdocId || ''
    }
  }

  return null
}

const CONTRACT_ABI = [...PramaanABI.abi, ...ZK_METHOD_ABI]

export default function WorkerDashboard() {
  const ui = {
    text: '#2f2a22',
    muted: '#776e61',
    card: '#fffdf9',
    border: '#ddd3c1',
    accent: '#a14b2a',
    accentSoft: '#f4e4d9',
    success: '#3e6a3d',
    successSoft: '#edf6eb',
    warn: '#91572f',
    warnSoft: '#f8ecd9',
    error: '#9c3f2d',
    errorSoft: '#f9ebe7'
  }

  const { address } = useAccount()
  const { writeContractAsync } = useWriteContract()
  const publicClient = usePublicClient()
  const [anonAadhaar] = useAnonAadhaar()
  const [, latestProof] = useProver()

  const [step1Done, setStep1Done] = useState(false)
  const [step2Done, setStep2Done] = useState(false)
  const [gigScore, setGigScore] = useState(null)

  const [identityQR, setIdentityQR] = useState(null)
  const [incomeQR, setIncomeQR] = useState(null)

  const [identityLoading, setIdentityLoading] = useState(false)
  const [incomeLoading, setIncomeLoading] = useState(false)
  const [scoreLoading, setScoreLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [error, setError] = useState(null)
  const [selectedProvider, setSelectedProvider] = useState('sbi')

  const [identityData, setIdentityData] = useState(null)
  const [incomeData, setIncomeData] = useState(null)
  const [scoreTxHash, setScoreTxHash] = useState(null)
  const [identityTxHash, setIdentityTxHash] = useState(null)
  const [incomeTxHash, setIncomeTxHash] = useState(null)
  const [identityTxState, setIdentityTxState] = useState('idle')
  const [incomeTxState, setIncomeTxState] = useState('idle')
  const [scoreTxState, setScoreTxState] = useState('idle')
  const [preflightError, setPreflightError] = useState(null)
  const [identityMethod, setIdentityMethod] = useState('anon')
  const [showAnonLogin, setShowAnonLogin] = useState(false)
  const [mockProfile, setMockProfile] = useState(null)
  const [zkMethodsSupported, setZkMethodsSupported] = useState(null)
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth))

  useEffect(() => {
    if (typeof window === 'undefined') return

    function onResize() {
      setViewportWidth(window.innerWidth)
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    setShowAnonLogin(false)
  }, [address])

  useEffect(() => {
    if (anonAadhaar?.status === 'logged-in') {
      setShowAnonLogin(false)
    }
  }, [anonAadhaar?.status])

  const isMobile = viewportWidth < 768
  const qrSize = isMobile ? 160 : 200
  const mockAssignedQrSize = isMobile ? 132 : 160
  const mockIncomeModeLabel = USE_ZK_SUBMISSION
    ? (zkMethodsSupported === false ? 'Mock (legacy fallback)' : 'Mock ZK')
    : 'Mock'

  async function detectZkMethodSupport() {
    if (!publicClient || !CONTRACT_ADDRESS) {
      setZkMethodsSupported(false)
      return false
    }

    try {
      const bytecode = await publicClient.getBytecode({ address: CONTRACT_ADDRESS })
      const code = String(bytecode || '').toLowerCase()
      const supports = code.includes(IDENTITY_ZK_SELECTOR) && code.includes(INCOME_ZK_SELECTOR)
      setZkMethodsSupported(supports)
      return supports
    } catch (_) {
      setZkMethodsSupported(false)
      return false
    }
  }

  useEffect(() => {
    detectZkMethodSupport()
  }, [publicClient, CONTRACT_ADDRESS])

  function renderTxStatus(state, txHash, label) {
    if (state === 'idle') return null

    const styles = {
      pending: { bg: ui.warnSoft, border: '#e5cfab', text: ui.warn, textLabel: `${label}: Pending confirmation...` },
      success: { bg: ui.successSoft, border: '#c6dec5', text: ui.success, textLabel: `${label}: Confirmed on-chain` },
      failed: { bg: ui.errorSoft, border: '#ebc5bc', text: ui.error, textLabel: `${label}: Failed` }
    }

    const cfg = styles[state]
    return (
      <div style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', color: cfg.text, fontSize: '12px' }}>
        <div>{cfg.textLabel}</div>
        {txHash && (
          <div style={{ marginTop: '4px' }}>
            <a
              href={`${EXPLORER_TX_BASE_URL}${txHash}`}
              target='_blank'
              rel='noreferrer'
              style={{ color: ui.muted, wordBreak: 'break-all' }}
            >
              Tx: {txHash}
            </a>
          </div>
        )}
      </div>
    )
  }

  async function getSafeGasLimit(functionName, args) {
    const fallbackGas = 900000n
    if (!publicClient || !address) return fallbackGas

    try {
      const estimated = await publicClient.estimateContractGas({
        account: address,
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName,
        args
      })

      // Keep gas under common RPC/provider caps and add headroom.
      const withBuffer = (estimated * 120n) / 100n
      const hardCap = 8000000n
      return withBuffer > hardCap ? hardCap : withBuffer
    } catch (err) {
      console.warn('Gas estimation failed, using fallback:', err)
      return fallbackGas
    }
  }

  async function waitForReceiptWithChainFallback(hash, verificationType) {
    if (!publicClient) return true

    try {
      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        timeout: 120000
      })
      return receipt.status === 'success'
    } catch (_) {
      if (verificationType === 'identity') {
        return await isIdentityAlreadyVerifiedOnChain()
      }
      if (verificationType === 'income') {
        return await isIncomeAlreadyVerifiedOnChain()
      }
      return false
    }
  }

  useEffect(() => {
    if (!address || !USE_MOCK_ZK) return

    let cancelled = false
    async function loadProfile() {
      try {
        const res = await fetch(`${BACKEND_URL}/api/mock/profile/${address}`)
        const data = await res.json()
        if (!cancelled && res.ok && data?.profile) {
          setMockProfile(data.profile)
        }
      } catch (_) {
        // Best-effort helper data; silent on failure.
      }
    }

    loadProfile()
    return () => {
      cancelled = true
    }
  }, [address])

  async function isIdentityAlreadyVerifiedOnChain() {
    const profile = await getWorkerProfileOnChain()
    if (profile) return Boolean(profile.identityVerified)

    if (!publicClient || !address) return false
    try {
      const fullyVerified = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: PramaanABI.abi,
        functionName: 'isVerified',
        args: [address]
      })
      return Boolean(fullyVerified)
    } catch (_) {
      return false
    }
  }

  async function getWorkerProfileOnChain() {
    if (!publicClient || !address) return null
    try {
      const extendedProfile = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: WORKER_GETTER_ABI,
        functionName: 'workers',
        args: [address]
      })

      const normalizedExtended = normalizeWorkerProfile(extendedProfile)
      if (normalizedExtended) return normalizedExtended
    } catch (_) {
      // Try legacy ABI shape used by older deployments.
    }

    try {
      const legacyProfile = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: PramaanABI.abi,
        functionName: 'workers',
        args: [address]
      })

      const normalizedLegacy = normalizeWorkerProfile(legacyProfile)
      if (normalizedLegacy) return normalizedLegacy
    } catch (_) {
      // Best effort sync from chain.
    }

    return null
  }

  async function isIncomeAlreadyVerifiedOnChain() {
    const profile = await getWorkerProfileOnChain()
    return Boolean(profile?.incomeVerified)
  }

  useEffect(() => {
    if (!address) {
      setStep1Done(false)
      setStep2Done(false)
      setGigScore(null)
      setIdentityData(null)
      setIncomeData(null)
      return
    }

    let cancelled = false
    async function syncProfileState() {
      const profile = await getWorkerProfileOnChain()
      if (!profile || cancelled) return

      setStep1Done(Boolean(profile.identityVerified))
      setStep2Done(Boolean(profile.incomeVerified))
      if (profile.gigScore > 0) {
        setGigScore(profile.gigScore)
      }

      if (profile.identityDdocId) {
        setIdentityData((prev) => ({ ...(prev || {}), ddocId: profile.identityDdocId }))
      }

      if (profile.incomeDdocId || profile.platform) {
        setIncomeData((prev) => ({
          ...(prev || {}),
          ddocId: profile.incomeDdocId || prev?.ddocId,
          platform: profile.platform || prev?.platform
        }))
      }
    }

    syncProfileState()
    return () => {
      cancelled = true
    }
  }, [address, publicClient])

  // ─── Step 1: Reclaim Identity — poll backend for proof status ───
  useEffect(() => {
    if (identityMethod !== 'reclaim' || !identityQR || step1Done) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/reclaim/status/identity/${address}`)
        const data = await res.json()
        if (data.expired) {
          clearInterval(interval)
          setIdentityQR(null)
          setError('Identity session expired. Generate a new QR and complete quickly.')
          return
        }
        if (data.ready) {
          clearInterval(interval)
          setIdentityData(data)
          setIdentityQR(null)
          await handleSubmitIdentity(data.ddocId, data.proofHash)
        }
      } catch (err) {
        console.error('Identity polling error:', err)
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [identityMethod, identityQR, step1Done, address])

  async function hashAnonProof(proof, walletAddress) {
    const payload = JSON.stringify({
      walletAddress: (walletAddress || '').toLowerCase(),
      nullifier: proof.nullifier,
      timestamp: proof.timestamp,
      ageAbove18: proof.ageAbove18 ?? proof.revealAgeAbove18 ?? 0
    })
    const bytes = new TextEncoder().encode(payload)
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const hex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('')
    return `anon:${hex}`
  }

  async function runReclaimPreflight() {
    const res = await fetch(`${BACKEND_URL}/api/reclaim/preflight`)
    const data = await res.json()
    if (!res.ok || !data.ok || !data.callbackHealthy) {
      throw new Error('Backend callback is not reachable. Keep backend and ngrok running, then retry.')
    }
  }

  async function handleGenerateIdentityQR() {
    setIdentityLoading(true)
    setError(null)
    setPreflightError(null)
    try {
      await runReclaimPreflight()
      const res = await fetch(`${BACKEND_URL}/api/reclaim/identity-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setIdentityQR(data.requestUrl)
    } catch (err) {
      setPreflightError(err.message)
      setError('Failed to generate identity QR: ' + err.message)
    }
    setIdentityLoading(false)
  }

  async function handleSubmitIdentity(ddocId, proofHash) {
    setSubmitting(true)
    setError(null)
    setIdentityTxHash(null)
    setIdentityTxState('pending')
    try {
      const alreadyVerified = await isIdentityAlreadyVerifiedOnChain()
      if (alreadyVerified) {
        setIdentityTxState('success')
        setStep1Done(true)
        setSubmitting(false)
        return
      }

      const gas = await getSafeGasLimit('submitIdentity', [ddocId, proofHash])
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'submitIdentity',
        args: [ddocId, proofHash],
        gas
      })
      console.log('Identity tx:', hash)
      setIdentityTxHash(hash)
      const ok = await waitForReceiptWithChainFallback(hash, 'identity')
      if (!ok) {
        throw new Error('Identity transaction failed on-chain')
      }
      setIdentityTxState('success')
      setStep1Done(true)
    } catch (err) {
      setIdentityTxState('failed')
      setError('Identity submission failed: ' + err.message)
    }
    setSubmitting(false)
  }

  async function handleSubmitIdentityZK({ proof, publicSignals, ddocId }) {
    setSubmitting(true)
    setError(null)
    setIdentityTxHash(null)
    setIdentityTxState('pending')
    try {
      const alreadyVerified = await isIdentityAlreadyVerifiedOnChain()
      if (alreadyVerified) {
        setIdentityTxState('success')
        setStep1Done(true)
        setSubmitting(false)
        return
      }

      const gas = await getSafeGasLimit('submitIdentityZK', [proof, publicSignals, ddocId])
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'submitIdentityZK',
        args: [proof, publicSignals, ddocId],
        gas
      })
      console.log('Identity ZK tx:', hash)
      setIdentityTxHash(hash)
      const ok = await waitForReceiptWithChainFallback(hash, 'identity')
      if (!ok) {
        throw new Error('Identity ZK transaction failed on-chain')
      }
      setIdentityTxState('success')
      setStep1Done(true)
    } catch (err) {
      setIdentityTxState('failed')
      setError('Identity ZK submission failed: ' + err.message)
    }
    setSubmitting(false)
  }

  async function handleSubmitAnonIdentity() {
    setError(null)
    if (!latestProof?.proof || !address) {
      setError('Anon Aadhaar proof not ready yet. Complete the login flow first.')
      return
    }

    if (anonAadhaar?.status !== 'logged-in') {
      setError('Anon Aadhaar is not logged in for this wallet yet. Open Anon Aadhaar Login and create a fresh proof.')
      return
    }

    try {
      const proofHash = await hashAnonProof(latestProof.proof, address)

      if (publicClient) {
        try {
          const alreadyUsed = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: PramaanABI.abi,
            functionName: 'usedProofHashes',
            args: [proofHash]
          })

          if (alreadyUsed) {
            throw new Error('This Anon proof hash was already used. Open Anon Aadhaar Login and create a fresh proof for the current wallet.')
          }
        } catch (lookupErr) {
          const msg = String(lookupErr?.message || '')
          if (msg.includes('already used')) throw lookupErr
        }
      }

      // Store ZK proof via our backend
      const res = await fetch(`http://localhost:3000/api/zk/anon-aadhaar/${address}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proof: latestProof.proof })
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to save Anon Aadhaar proof')
      }

      const { ddocId } = await res.json()

      await handleSubmitIdentity(ddocId, proofHash)
      setIdentityData({ ddocId, method: 'anon-aadhaar' })
    } catch (err) {
      setError('Anon Aadhaar submission failed: ' + err.message)
    }
  }

  async function handleVerifyMockIdentity() {
    setError(null)
    if (!address) {
      setError('Connect wallet first.')
      return
    }

    try {
      const profileRes = await fetch(`${BACKEND_URL}/api/mock/profile/${address}`)
      const profileData = await profileRes.json()
      if (!profileRes.ok) throw new Error(profileData.error || 'Failed to load mock profile')
      setMockProfile(profileData.profile)

      const res = await fetch(`${BACKEND_URL}/api/mock/identity-verify/${address}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Mock identity verification failed')

      const canUseZkSubmission = USE_ZK_SUBMISSION ? await detectZkMethodSupport() : false
      if (USE_ZK_SUBMISSION && canUseZkSubmission) {
        const zkRes = await fetch(`${BACKEND_URL}/api/zk/identity-proof/${address}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
        const zkData = await zkRes.json()
        if (!zkRes.ok) throw new Error(zkData.error || 'Failed to build identity ZK proof-pack')
        await handleSubmitIdentityZK({
          proof: zkData.proof,
          publicSignals: zkData.publicSignals,
          ddocId: zkData.ddocId
        })
        setIdentityData({ ddocId: zkData.ddocId, method: 'mock-zk-verifier-gated' })
      } else {
        await handleSubmitIdentity(data.ddocId, data.proofHash)
        setIdentityData({ ddocId: data.ddocId, method: 'mock-zk' })

        if (USE_ZK_SUBMISSION) {
          setPreflightError('Deployed contract does not expose submitIdentityZK. Used legacy identity submission automatically.')
        }
      }
    } catch (err) {
      setError('Mock identity verification failed: ' + err.message)
    }
  }

  // ─── Step 2: Reclaim Income — poll backend for proof status ───
  useEffect(() => {
    if (!incomeQR || step2Done) return
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/reclaim/status/income/${address}`)
        const data = await res.json()
        if (data.expired) {
          clearInterval(interval)
          setIncomeQR(null)
          setError('Income session expired. Generate a new QR and complete quickly.')
          return
        }
        if (data.ready) {
          clearInterval(interval)
          setIncomeData(data)
          setIncomeQR(null)
          await handleSubmitIncome(data.ddocId, data.platform, data.proofHash)
        }
      } catch (err) {
        console.error('Polling error:', err)
      }
    }, 3000)
    return () => clearInterval(interval)
  }, [incomeQR, step2Done, address])

  async function handleGenerateIncomeQR() {
    setIncomeLoading(true)
    setError(null)
    setPreflightError(null)
    try {
      if (selectedProvider === 'uber' && !ENABLE_UBER_PROVIDER) {
        throw new Error('Uber provider is currently disabled. Use SBI or enable UBER provider in env.')
      }

      await runReclaimPreflight()
      const res = await fetch(`${BACKEND_URL}/api/reclaim/generate-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address, provider: selectedProvider })
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setIncomeQR(data.requestUrl)
    } catch (err) {
      setPreflightError(err.message)
      setError('Failed to generate income QR: ' + err.message)
    }
    setIncomeLoading(false)
  }

  async function handleVerifyMockIncome() {
    if (step2Done || await isIncomeAlreadyVerifiedOnChain()) {
      setStep2Done(true)
      return
    }

    setIncomeLoading(true)
    setError(null)
    try {
      const res = await fetch(`${BACKEND_URL}/api/mock/income-verify/${address}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: selectedProvider })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Mock income verification failed')

      const canUseZkSubmission = USE_ZK_SUBMISSION ? await detectZkMethodSupport() : false
      if (USE_ZK_SUBMISSION && canUseZkSubmission) {
        const zkRes = await fetch(`${BACKEND_URL}/api/zk/income-proof/${address}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider: selectedProvider })
        })
        const zkData = await zkRes.json()
        if (!zkRes.ok) throw new Error(zkData.error || 'Failed to build income ZK proof-pack')
        await handleSubmitIncomeZK({
          proof: zkData.proof,
          publicSignals: zkData.publicSignals,
          ddocId: zkData.ddocId,
          platform: zkData.platform
        })
        setIncomeData({ ddocId: zkData.ddocId, platform: zkData.platform, payload: zkData.payload, method: 'mock-zk-verifier-gated' })
      } else {
        await handleSubmitIncome(data.ddocId, data.platform, data.proofHash)
        setIncomeData({ ddocId: data.ddocId, platform: data.platform, payload: data.payload, method: 'mock-zk' })

        if (USE_ZK_SUBMISSION) {
          setPreflightError('Deployed contract does not expose submitIncomeZK. Used legacy income submission automatically.')
        }
      }
    } catch (err) {
      setError('Mock income verification failed: ' + err.message)
    }
    setIncomeLoading(false)
  }

  async function handleSubmitIncomeZK({ proof, publicSignals, ddocId, platform }) {
    setSubmitting(true)
    setError(null)
    setIncomeTxHash(null)
    setIncomeTxState('pending')
    try {
      const alreadyIncomeVerified = await isIncomeAlreadyVerifiedOnChain()
      if (alreadyIncomeVerified) {
        setIncomeTxState('success')
        setStep2Done(true)
        setSubmitting(false)
        return
      }

      const identityVerified = await isIdentityAlreadyVerifiedOnChain()
      if (!identityVerified) {
        throw new Error('Identity transaction is not finalized yet. Wait a few seconds and retry income submission.')
      }

      const gas = await getSafeGasLimit('submitIncomeZK', [proof, publicSignals, ddocId, platform || 'SBI'])
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'submitIncomeZK',
        args: [proof, publicSignals, ddocId, platform || 'SBI'],
        gas
      })
      console.log('Income ZK tx:', hash)
      setIncomeTxHash(hash)
      const ok = await waitForReceiptWithChainFallback(hash, 'income')
      if (!ok) {
        throw new Error('Income ZK transaction failed on-chain')
      }
      setIncomeTxState('success')
      setStep2Done(true)
    } catch (err) {
      const message = String(err?.message || '')
      if (message.includes('Nullifier already used')) {
        const alreadyIncomeVerified = await isIncomeAlreadyVerifiedOnChain()
        if (alreadyIncomeVerified) {
          setIncomeTxState('success')
          setStep2Done(true)
          setSubmitting(false)
          return
        }
      }

      setIncomeTxState('failed')
      setError('Income ZK submission failed: ' + err.message)
    }
    setSubmitting(false)
  }

  async function handleSubmitIncome(ddocId, platform, proofHash) {
    setSubmitting(true)
    setError(null)
    setIncomeTxHash(null)
    setIncomeTxState('pending')
    try {
      const alreadyIncomeVerified = await isIncomeAlreadyVerifiedOnChain()
      if (alreadyIncomeVerified) {
        setIncomeTxState('success')
        setStep2Done(true)
        setSubmitting(false)
        return
      }

      const gas = await getSafeGasLimit('submitIncome', [ddocId, platform || 'SBI', proofHash])
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: CONTRACT_ABI,
        functionName: 'submitIncome',
        args: [ddocId, platform || 'SBI', proofHash],
        gas
      })
      console.log('Income tx:', hash)
      setIncomeTxHash(hash)
      const ok = await waitForReceiptWithChainFallback(hash, 'income')
      if (!ok) {
        throw new Error('Income transaction failed on-chain')
      }
      setIncomeTxState('success')
      setStep2Done(true)
    } catch (err) {
      setIncomeTxState('failed')
      setError('Income submission failed: ' + err.message)
    }
    setSubmitting(false)
  }

  // ─── Step 3: GigScore ───
  async function checkGigScore() {
    setScoreLoading(true)
    setError(null)
    setScoreTxHash(null)
    setScoreTxState('pending')
    try {
      const res = await fetch(`${BACKEND_URL}/api/agent/score/${address}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: incomeData?.platform || selectedProvider?.toUpperCase?.() || 'SBI' })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to assign score')

      setGigScore(data.score)
      setScoreTxHash(data.txHash)
      setScoreTxState('success')
      
    } catch (err) {
      setScoreTxState('failed')
      setError('GigScore assignment failed: ' + err.message)
    }
    setScoreLoading(false)
  }

  const stepStyle = (active, done) => ({
    background: done ? ui.successSoft : active ? ui.card : '#f4efe5',
    border: `1px solid ${done ? '#c6dec5' : active ? ui.border : '#e5dccd'}`,
    borderRadius: '12px',
    padding: isMobile ? '16px' : '24px',
    marginBottom: '16px',
    opacity: active || done ? 1 : 0.4,
    transition: 'all 0.3s'
  })

  return (
    <div style={{ maxWidth: '760px', width: '100%', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '8px', fontSize: isMobile ? '22px' : '24px', color: ui.text }}>Worker Dashboard</h2>
      <p style={{ color: ui.muted, marginBottom: '32px', fontSize: '14px' }}>
        Complete 3 steps to get your verified GigScore on-chain
      </p>

      {error && (
        <div style={{ background: ui.errorSoft, border: '1px solid #ebc5bc', borderRadius: '8px', padding: '12px', marginBottom: '16px', color: ui.error, fontSize: '13px' }}>
          {error}
        </div>
      )}

      {preflightError && (
        <div style={{ background: ui.warnSoft, border: '1px solid #e5cfab', borderRadius: '8px', padding: '12px', marginBottom: '16px', color: ui.warn, fontSize: '13px' }}>
          {preflightError}
        </div>
      )}

      {/* Step 1 — Identity via Reclaim Protocol */}
      <div style={stepStyle(true, step1Done)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '16px' }}>Step 1 — Verify Identity</h3>
          {step1Done && <span style={{ color: ui.success, fontSize: '18px', fontWeight: 'bold' }}>✓ Done</span>}
        </div>
        <p style={{ color: ui.muted, fontSize: '13px', marginBottom: '16px' }}>
          Prove your identity. Recommended: Anon Aadhaar (18+ only). Reclaim remains available as fallback.
        </p>

        {renderTxStatus(identityTxState, identityTxHash, 'Identity transaction')}

        {USE_MOCK_ZK && (
          <div style={{ background: ui.successSoft, border: '1px solid #c6dec5', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', color: ui.success, fontSize: '12px' }}>
            Mock mode is enabled for income and scoring. Identity is recommended via Anon Aadhaar test flow for realistic end-to-end verification.
          </div>
        )}

        {!step1Done && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
            {USE_MOCK_ZK && ENABLE_MOCK_IDENTITY_BUTTON && (
              <button
                onClick={() => {
                  setIdentityMethod('mock')
                  setShowAnonLogin(false)
                  setIdentityQR(null)
                  setError(null)
                }}
                style={{ background: identityMethod === 'mock' ? ui.accentSoft : 'transparent', color: identityMethod === 'mock' ? ui.accent : ui.muted, border: `1px solid ${ui.border}`, padding: '6px 14px', borderRadius: '999px', cursor: 'pointer', fontSize: '13px' }}
              >
                Mock Identity (Advanced)
              </button>
            )}
            <button
              onClick={() => {
                setIdentityMethod('anon')
                setShowAnonLogin(false)
                setIdentityQR(null)
                setError(null)
              }}
              style={{ background: identityMethod === 'anon' ? ui.accentSoft : 'transparent', color: identityMethod === 'anon' ? ui.accent : ui.muted, border: `1px solid ${ui.border}`, padding: '6px 14px', borderRadius: '999px', cursor: 'pointer', fontSize: '13px' }}
            >
              Anon Aadhaar (18+)
            </button>
            <button
              onClick={() => {
                setIdentityMethod('reclaim')
                setShowAnonLogin(false)
                setError(null)
              }}
              style={{ background: identityMethod === 'reclaim' ? ui.accentSoft : 'transparent', color: identityMethod === 'reclaim' ? ui.accent : ui.muted, border: `1px solid ${ui.border}`, padding: '6px 14px', borderRadius: '999px', cursor: 'pointer', fontSize: '13px' }}
            >
              Reclaim QR
            </button>
          </div>
        )}

        {!step1Done && identityMethod === 'mock' && (
          <div>
            <p style={{ color: ui.muted, fontSize: '13px', marginBottom: '12px' }}>
              Uses fixture JSON from backend to simulate proof generation and verify worker eligibility.
            </p>
            <button
              onClick={handleVerifyMockIdentity}
              disabled={submitting}
              style={{ background: ui.accent, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
            >
              {submitting ? 'Submitting...' : 'Verify Mock Identity and Submit On-Chain'}
            </button>
            {mockProfile && (
              <p style={{ color: ui.muted, fontSize: '12px', marginTop: '10px' }}>
                Fixture loaded: country={mockProfile.country}, ageAbove18={String(mockProfile.ageAbove18)}
              </p>
            )}
          </div>
        )}

        {!step1Done && identityMethod === 'anon' && (
          <div>
            <p style={{ color: ui.muted, fontSize: '13px', marginBottom: '12px' }}>
              This path only checks age above 18 and does not require gender/state/pincode.
            </p>
            {USE_MOCK_ZK && mockProfile?.workerTag && (
              <div style={{ background: '#f4efe5', border: `1px solid ${ui.border}`, borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', color: ui.text, fontSize: '12px' }}>
                Worker profile: {mockProfile.workerTag}
              </div>
            )}
            <div style={{ background: ui.warnSoft, border: '1px solid #e5cfab', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', color: ui.warn, fontSize: '12px' }}>
              <div style={{ marginBottom: '6px', fontWeight: 600 }}>
                Mode: {USE_TEST_AADHAAR ? 'Test Aadhaar' : 'Production Aadhaar'}
              </div>
              {USE_TEST_AADHAAR ? (
                <div>
                  Use only test QR data generated from the Anon Aadhaar test generator. Real UIDAI QR data will fail in test mode.
                </div>
              ) : (
                <div>
                  Use real UIDAI secure QR data (from e-Aadhaar/official source). Test generator QR data will fail in production mode.
                </div>
              )}
            </div>
            {USE_TEST_AADHAAR && mockProfile?.anonTestQrData && (
              <div style={{ background: '#f4efe5', border: `1px solid ${ui.border}`, borderRadius: '10px', padding: '12px', marginBottom: '12px' }}>
                <div style={{ color: ui.text, fontSize: '12px', marginBottom: '10px' }}>
                  Assigned test QR payload for this wallet (for tracking/demo mapping)
                </div>
                <div style={{ background: '#fff', padding: '10px', borderRadius: '8px', display: 'inline-block' }}>
                  <QRCode value={mockProfile.anonTestQrData} size={mockAssignedQrSize} />
                </div>
                <div style={{ color: ui.muted, fontSize: '11px', marginTop: '8px', wordBreak: 'break-all' }}>
                  {mockProfile.anonTestQrData}
                </div>
              </div>
            )}
            {anonAadhaar?.status !== 'logged-in' && (
              <button
                onClick={() => setShowAnonLogin((prev) => !prev)}
                style={{ marginTop: '6px', background: showAnonLogin ? ui.accentSoft : '#fff', color: showAnonLogin ? ui.accent : ui.text, border: `1px solid ${ui.border}`, padding: '10px 14px', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
              >
                {showAnonLogin ? 'Hide Anon Aadhaar Login' : 'Open Anon Aadhaar Login'}
              </button>
            )}

            {showAnonLogin && anonAadhaar?.status !== 'logged-in' && (
              <div style={{ marginTop: '10px' }}>
                <LogInWithAnonAadhaar
                  nullifierSeed={ANON_NULLIFIER_SEED}
                  fieldsToReveal={['revealAgeAbove18']}
                  signal={address || '0x0'}
                />
              </div>
            )}
            <p style={{ color: ui.muted, fontSize: '12px', marginTop: '8px' }}>
              Anon Aadhaar status: {anonAadhaar?.status || 'idle'}
            </p>
            <p style={{ color: ui.muted, fontSize: '12px', marginTop: '6px' }}>
              If you see "Invalid QR Code", your QR source does not match the active mode above.
            </p>

            <p style={{ color: ui.muted, fontSize: '12px', marginTop: '6px' }}>
              If you switched wallet accounts, open Anon Aadhaar Login again and generate a fresh proof before submitting.
            </p>

            {anonAadhaar?.status === 'logged-in' && (
              <button
                onClick={handleSubmitAnonIdentity}
                disabled={submitting}
                style={{ marginTop: '12px', background: ui.accent, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
              >
                {submitting ? 'Submitting...' : 'Submit Anon Aadhaar Identity On-Chain'}
              </button>
            )}
          </div>
        )}

        {!step1Done && identityMethod === 'reclaim' && !identityQR && !submitting && (
          <div>
            <button
              onClick={handleGenerateIdentityQR}
              disabled={identityLoading}
              style={{ background: ui.accent, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
            >
              {identityLoading ? 'Generating...' : 'Generate Identity QR'}
            </button>
          </div>
        )}

        {identityMethod === 'reclaim' && identityQR && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: ui.muted, fontSize: '13px', marginBottom: '12px' }}>
              Scan with your phone → Open DigiLocker/Aadhaar flow → Authorize → Proof auto-submits
            </p>
            <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', display: 'inline-block' }}>
              <QRCode value={identityQR} size={qrSize} />
            </div>
            <div style={{ marginTop: '12px' }}>
              <a href={identityQR} target="_blank" rel="noreferrer" style={{ color: ui.accent, fontSize: '12px' }}>
                Open verification link directly
              </a>
            </div>
            <p style={{ color: ui.muted, fontSize: '12px', marginTop: '12px' }}>
              Waiting for identity proof... scanning every 3 seconds. If it times out, generate a fresh QR.
            </p>
          </div>
        )}

        {submitting && !step1Done && (
          <p style={{ color: ui.warn, fontSize: '14px' }}>Submitting identity proof to blockchain...</p>
        )}

        {step1Done && (
          <div>
            <p style={{ color: ui.success, fontSize: '14px', margin: 0 }}>✓ Identity verified and stored on-chain</p>
            {identityData?.ddocId && (
              <p style={{ color: ui.muted, fontSize: '11px', marginTop: '4px' }}>Proof ID: {identityData.ddocId}</p>
            )}
          </div>
        )}
      </div>

      {/* Step 2 — Income via Reclaim Protocol */}
      <div style={stepStyle(step1Done, step2Done)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '16px' }}>Step 2 — Verify Income</h3>
          {step2Done && <span style={{ color: ui.success, fontSize: '18px', fontWeight: 'bold' }}>✓ Done</span>}
        </div>
        <p style={{ color: ui.muted, fontSize: '13px', marginBottom: '16px' }}>
          Prove your income via SBI bank account or Uber driver account. Encrypted and stored privately via Reclaim Protocol.
        </p>

        {renderTxStatus(incomeTxState, incomeTxHash, 'Income transaction')}

        {USE_MOCK_ZK && USE_ZK_SUBMISSION && zkMethodsSupported === false && (
          <div style={{ background: ui.warnSoft, border: '1px solid #e5cfab', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px', color: ui.warn, fontSize: '12px' }}>
            This deployed contract does not support ZK income methods. Falling back to legacy on-chain income submission.
          </div>
        )}

        {step1Done && !step2Done && !incomeQR && !submitting && (
          <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setSelectedProvider('sbi')}
                style={{ background: selectedProvider === 'sbi' ? ui.accentSoft : 'transparent', color: selectedProvider === 'sbi' ? ui.accent : ui.muted, border: `1px solid ${ui.border}`, padding: '6px 14px', borderRadius: '999px', cursor: 'pointer', fontSize: '13px' }}
              >
                SBI Bank
              </button>
              {ENABLE_UBER_PROVIDER && (
                <button
                  onClick={() => setSelectedProvider('uber')}
                  style={{ background: selectedProvider === 'uber' ? ui.accentSoft : 'transparent', color: selectedProvider === 'uber' ? ui.accent : ui.muted, border: `1px solid ${ui.border}`, padding: '6px 14px', borderRadius: '999px', cursor: 'pointer', fontSize: '13px' }}
                >
                  Uber Driver
                </button>
              )}
            </div>
            <button
              onClick={USE_MOCK_ZK ? handleVerifyMockIncome : handleGenerateIncomeQR}
              disabled={incomeLoading}
              style={{ background: ui.accent, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
            >
              {incomeLoading ? 'Generating...' : USE_MOCK_ZK ? `Verify ${selectedProvider === 'sbi' ? 'SBI' : 'Uber'} Income (${mockIncomeModeLabel})` : `Verify ${selectedProvider === 'sbi' ? 'SBI' : 'Uber'} Income`}
            </button>
          </div>
        )}

        {incomeQR && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: ui.muted, fontSize: '13px', marginBottom: '12px' }}>
              Scan with your phone → Login to {selectedProvider === 'sbi' ? 'SBI NetBanking' : 'Uber'} → Proof auto-submits
            </p>
            <div style={{ background: '#fff', padding: '16px', borderRadius: '8px', display: 'inline-block' }}>
              <QRCode value={incomeQR} size={qrSize} />
            </div>
            <div style={{ marginTop: '12px' }}>
              <a href={incomeQR} target="_blank" rel="noreferrer" style={{ color: ui.accent, fontSize: '12px' }}>
                Open verification link directly
              </a>
            </div>
            <p style={{ color: ui.muted, fontSize: '12px', marginTop: '12px' }}>
              Waiting for proof... scanning every 3 seconds. If it times out, generate a fresh QR.
            </p>
          </div>
        )}

        {submitting && !step2Done && (
          <p style={{ color: ui.warn, fontSize: '14px' }}>Submitting income proof to blockchain...</p>
        )}

        {step2Done && (
          <div>
            <p style={{ color: ui.success, fontSize: '14px', margin: 0 }}>✓ Income verified and stored on-chain</p>
          </div>
        )}
      </div>

      {/* Step 3 — GigScore */}
      <div style={stepStyle(step2Done, gigScore !== null)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h3 style={{ margin: 0, fontSize: '16px' }}>Step 3 — Your GigScore</h3>
          {gigScore !== null && <span style={{ color: ui.success, fontSize: '18px', fontWeight: 'bold' }}>✓ Done</span>}
        </div>
        <p style={{ color: ui.muted, fontSize: '13px', marginBottom: '16px' }}>
          AI Agent analyzes your encrypted proof and writes your GigScore permanently on-chain.
        </p>

        {renderTxStatus(scoreTxState, scoreTxHash, 'Score transaction')}

        {step2Done && gigScore === null && (
          <button
            onClick={checkGigScore}
            disabled={scoreLoading}
            style={{ background: ui.accent, color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
          >
            {scoreLoading ? 'Assigning GigScore...' : 'Check My GigScore'}
          </button>
        )}

        {gigScore !== null && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: '80px', fontWeight: 'bold', color: ui.success, lineHeight: 1 }}>{gigScore}</div>
            <div style={{ color: ui.muted, fontSize: '14px', marginTop: '8px' }}>out of 100</div>
            <div style={{ color: ui.muted, fontSize: '12px', marginTop: '8px' }}>Stored permanently on Ethereum Sepolia</div>
            {scoreTxHash && (
              <div style={{ fontSize: '11px', marginTop: '6px' }}>
                <a
                  href={`${EXPLORER_TX_BASE_URL}${scoreTxHash}`}
                  target='_blank'
                  rel='noreferrer'
                  style={{ color: ui.muted, wordBreak: 'break-all' }}
                >
                  Score Tx: {scoreTxHash}
                </a>
              </div>
            )}
            
          </div>
        )}
      </div>
    </div>
  )
}