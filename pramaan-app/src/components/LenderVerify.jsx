import { useEffect, useState } from 'react'
import { formatUnits } from 'viem'
import { useReadContract, useWriteContract, usePublicClient, useAccount } from 'wagmi'
import PramaanABI from '../abi/Pramaan.json'

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS

const ERC20_ABI = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
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

export default function LenderVerify() {
  const ui = {
    text: '#2f2a22',
    muted: '#776e61',
    card: '#fffdf9',
    border: '#ddd3c1',
    accent: '#a14b2a',
    accentSoft: '#f4e4d9',
    success: '#3e6a3d',
    successSoft: '#edf6eb',
    error: '#9c3f2d',
    errorSoft: '#f9ebe7'
  }

  const [workerAddress, setWorkerAddress] = useState('')
  const [lookupAddress, setLookupAddress] = useState(null)
  const [paying, setPaying] = useState(false)
  const [paid, setPaid] = useState(false)
  const [error, setError] = useState(null)
  const [approveTxHash, setApproveTxHash] = useState(null)
  const [verifyTxHash, setVerifyTxHash] = useState(null)
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth))

  const isMobile = viewportWidth < 768

  useEffect(() => {
    if (typeof window === 'undefined') return

    function onResize() {
      setViewportWidth(window.innerWidth)
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const publicClient = usePublicClient()
  const { address } = useAccount()
  const { writeContractAsync } = useWriteContract()

  const { data: usdcAddress } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PramaanABI.abi,
    functionName: 'usdc'
  })

  const { data: verificationFee } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PramaanABI.abi,
    functionName: 'verificationFee'
  })

  const { data: profile, isLoading, isError } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PramaanABI.abi,
    functionName: 'getWorkerProfile',
    args: [lookupAddress],
    query: { enabled: !!lookupAddress && paid }
  })

  const { data: score } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PramaanABI.abi,
    functionName: 'getGigScore',
    args: [lookupAddress],
    query: { enabled: !!lookupAddress && paid }
  })

  async function handleVerify() {
    if (!workerAddress || !publicClient || !usdcAddress || !verificationFee) return
    if (!/^0x[a-fA-F0-9]{40}$/.test(workerAddress)) {
      setError('Please enter a valid worker wallet address.')
      return
    }

    setPaying(true)
    setError(null)
    setApproveTxHash(null)
    setVerifyTxHash(null)

    try {
      console.log('--- STARTING VERIFICATION PROCESS ---')
      console.log('Target Worker Address:', workerAddress)
      console.log('USDC Address:', usdcAddress)
      console.log('Verification Fee:', verificationFee.toString())

      // Pre-flight check to get full worker state for debugging logs
      try {
        console.log('Checking worker profile state on-chain...')
        
        let profile
        try {
          profile = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: WORKER_GETTER_ABI,
            functionName: 'workers',
            args: [workerAddress]
          })
        } catch (_) {
          // fallback
          profile = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: PramaanABI.abi,
            functionName: 'workers',
            args: [workerAddress]
          })
        }

        console.dir('Worker Profile pre-check data:', profile)
        
        // Manual validation matching contract logic to prevent ugly gas limit errors
        const hasExtendedLayout = Array.isArray(profile) && profile.length >= 14
        const isExists = Array.isArray(profile) ? Boolean(profile[hasExtendedLayout ? 13 : 11]) : Boolean(profile.exists)
        const identityVerified = Array.isArray(profile) ? Boolean(profile[0]) : Boolean(profile.identityVerified)
        const incomeVerified = Array.isArray(profile) ? Boolean(profile[1]) : Boolean(profile.incomeVerified)
        const gigScore = Array.isArray(profile) ? Number(profile[2]) : Number(profile.gigScore)
        const lastUpdated = Array.isArray(profile) ? Number(profile[3]) : Number(profile.lastUpdated)
        
        if (!isExists) throw new Error("Worker not found on-chain. Have they registered?")
        if (!identityVerified || !incomeVerified) throw new Error("Worker profile is incomplete. They need both Identity & Income verified.")
        if (Number(gigScore) === 0) throw new Error("Worker GigScore is 0. Score is not set yet.")
        
        const ninetyDays = 90n * 24n * 60n * 60n
        const now = BigInt(Math.floor(Date.now() / 1000))
        if (now - BigInt(lastUpdated) >= ninetyDays) throw new Error("Worker score is expired (> 90 days).")
      } catch (checkErr) {
        throw checkErr // Fast fail with clear error instead of proceeding to tx
      }

      console.log('Initiating USDC approve...')
      const approveHash = await writeContractAsync({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACT_ADDRESS, verificationFee]
      })
      console.log('Approve tx submitted with hash:', approveHash)
      setApproveTxHash(approveHash)
      
      const approveReceipt = await publicClient.waitForTransactionReceipt({ hash: approveHash })
      console.log('Approve tx confirmed:', approveReceipt)

      console.log('Simulating verifyWorker to catch contract reverts...')
      if (address) {
        await publicClient.simulateContract({
          account: address,
          address: CONTRACT_ADDRESS,
          abi: PramaanABI.abi,
          functionName: 'verifyWorker',
          args: [workerAddress]
        })
      }

      console.log('Initiating verifyWorker...')
      const verifyHash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: PramaanABI.abi,
        functionName: 'verifyWorker',
        args: [workerAddress]
      })
      console.log('Verify tx submitted with hash:', verifyHash)
      setVerifyTxHash(verifyHash)
      
      const verifyReceipt = await publicClient.waitForTransactionReceipt({ hash: verifyHash })
      console.log('Verify tx confirmed:', verifyReceipt)

      setLookupAddress(workerAddress)
      setPaid(true)
      console.log('--- VERIFICATION SUCCESSFUL ---')
    } catch (err) {
      console.error('!!! VERIFICATION COMPLETELY FAILED !!!')
      console.error('Full error object:', err)
      if (err.cause) console.error('Error cause:', err.cause)

      const errorText = String(err?.shortMessage || err?.message || '')
      let humanReadableError = errorText

      // Map smart contract revert reasons to helpful frontend errors
      if (errorText.includes('Worker not found')) {
        humanReadableError = 'Verification Failed: Worker not found on-chain. Has this address started the registration?'
      } else if (errorText.includes('Profile incomplete')) {
        humanReadableError = 'Verification Failed: Profile incomplete. The worker must complete BOTH Identity (Step 1) and Income (Step 2) verification.'
      } else if (errorText.includes('Score not set')) {
        humanReadableError = 'Verification Failed: Score not set. Wait for the backend/AI agent to compute their GigScore.'
      } else if (errorText.includes('Score expired')) {
        humanReadableError = 'Verification Failed: Profile is older than 90 days. Score expired.'
      } else if (errorText.includes('Fee transfer failed') || errorText.includes('transfer amount exceeds')) {
        humanReadableError = 'Verification Failed: USDC fee transfer failed. Do you have enough Sepolia Base USDC and ETH?'
      }

      setError(humanReadableError)
      setPaid(false)
    }

    setPaying(false)
  }

  return (
    <div style={{ maxWidth: '760px', width: '100%', margin: '0 auto' }}>
      <h2 style={{ marginBottom: '8px', color: ui.text }}>Lender Verification</h2>
      <p style={{ color: ui.muted, marginBottom: '32px' }}>
        Pay a small USDC fee to instantly verify a worker's GigScore. No paperwork. No waiting.
      </p>

      {error && (
        <div style={{ background: ui.errorSoft, border: '1px solid #ebc5bc', borderRadius: '8px', padding: '12px', marginBottom: '16px', color: ui.error, fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* Input */}
      <div style={{ background: ui.card, border: `1px solid ${ui.border}`, borderRadius: '12px', padding: isMobile ? '16px' : '24px', marginBottom: '16px' }}>
        <label style={{ display: 'block', color: ui.muted, fontSize: '14px', marginBottom: '8px' }}>
          Worker Wallet Address
        </label>
        <input
          type="text"
          value={workerAddress}
          onChange={e => setWorkerAddress(e.target.value)}
          placeholder="0x..."
          style={{
            width: '100%',
            background: '#fff',
            border: `1px solid ${ui.border}`,
            borderRadius: '8px',
            padding: '12px',
            color: ui.text,
            fontSize: '14px',
            marginBottom: '16px',
            boxSizing: 'border-box'
          }}
        />

        <div style={{ background: '#f4efe5', border: `1px solid ${ui.border}`, borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: ui.muted, fontSize: '13px' }}>
            <span>Verification Fee</span>
            <span style={{ color: ui.text }}>
              {verificationFee ? `${formatUnits(verificationFee, 6)} USDC` : 'Loading...'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: ui.muted, fontSize: '13px', marginTop: '6px' }}>
            <span>Payment Method</span>
            <span style={{ color: ui.text }}>ERC20 Approve + Contract Verify</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: ui.muted, fontSize: '13px', marginTop: '6px' }}>
            <span>Response Time</span>
            <span style={{ color: ui.text }}>~2 on-chain tx confirmations</span>
          </div>
        </div>

        <button
          onClick={handleVerify}
          disabled={paying || !workerAddress || !verificationFee || !usdcAddress}
          style={{
            width: '100%',
            background: paying ? '#d8c8b7' : ui.accent,
            color: '#fff',
            border: 'none',
            padding: '14px',
            borderRadius: '10px',
            cursor: workerAddress ? 'pointer' : 'not-allowed',
            fontWeight: 'bold',
            fontSize: '16px'
          }}
        >
          {paying ? 'Processing Approve + Verify...' : 'Verify and Pay'}
        </button>

        {approveTxHash && (
          <p style={{ marginTop: '10px', color: ui.muted, fontSize: '11px' }}>Approve Tx: {approveTxHash}</p>
        )}
        {verifyTxHash && (
          <p style={{ marginTop: '4px', color: ui.muted, fontSize: '11px' }}>Verify Tx: {verifyTxHash}</p>
        )}
      </div>

      {/* Result */}
      {paid && lookupAddress && (
        <div style={{ background: ui.successSoft, border: '1px solid #c6dec5', borderRadius: '12px', padding: '24px' }}>
          <h3 style={{ margin: '0 0 16px 0', color: ui.success }}>Verification Complete</h3>

          {isLoading && <p style={{ color: ui.muted }}>Loading worker data...</p>}
          {isError && <p style={{ color: ui.error }}>Worker not found or not verified.</p>}

          {profile && (
            <div>
              <div style={{ textAlign: 'center', padding: '20px 0', borderBottom: '1px solid #1a3a2a', marginBottom: '16px' }}>
                <div style={{ fontSize: isMobile ? '56px' : '72px', fontWeight: 'bold', color: ui.success }}>
                  {score?.toString() || '0'}
                </div>
                <div style={{ color: ui.muted, fontSize: '14px' }}>GigScore out of 100</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: ui.muted }}>Platform</span>
                  <span style={{ color: ui.text }}>{profile.platform || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: ui.muted }}>Identity Verified</span>
                  <span style={{ color: profile.identityVerified ? ui.success : ui.error }}>
                    {profile.identityVerified ? 'Yes' : 'No'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: ui.muted }}>Income Verified</span>
                  <span style={{ color: profile.incomeVerified ? ui.success : ui.error }}>
                    {profile.incomeVerified ? 'Yes' : 'No'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: ui.muted }}>Fileverse Document</span>
                  <span style={{ color: ui.text, fontSize: '12px' }}>{profile.identityDdocId || profile.incomeDdocId || 'N/A'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: ui.muted }}>Last Updated</span>
                  <span style={{ color: ui.text }}>
                    {profile.lastUpdated > 0
                      ? new Date(Number(profile.lastUpdated) * 1000).toLocaleDateString()
                      : 'N/A'}
                  </span>
                </div>
              </div>

              <div style={{ marginTop: '16px', padding: '12px', background: '#f4efe5', borderRadius: '8px' }}>
                <p style={{ margin: 0, color: ui.muted, fontSize: '12px', textAlign: 'center' }}>
                  Payment processed via x402 Protocol • Verified on Ethereum Sepolia
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}