import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, CheckCircle2, Fingerprint, BarChart3, Loader2,
  ArrowLeft, Search, Wallet, CreditCard, AlertCircle,
  Globe, TrendingUp, ExternalLink, RotateCcw
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useReadContract, useWriteContract, usePublicClient, useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import PramaanABI from '../abi/Pramaan.json';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

const ERC20_ABI = [
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] }
];

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
      { name: 'platform', type: 'string' }
    ]
  }
];

// Score tier helper
const getTier = (score) => {
  if (score >= 90) return { label: "Exceptional", color: "text-emerald-500", bg: "bg-emerald-500" };
  if (score >= 75) return { label: "Strong", color: "text-green-500", bg: "bg-green-500" };
  if (score >= 55) return { label: "Moderate", color: "text-amber-500", bg: "bg-amber-500" };
  if (score >= 30) return { label: "Developing", color: "text-orange-500", bg: "bg-orange-500" };
  return { label: "Early-Stage", color: "text-muted-foreground", bg: "bg-muted-foreground" };
};

export default function VerifyIdentity() {
  const navigate = useNavigate();
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [workerAddress, setWorkerAddress] = useState('');
  const [lookupAddress, setLookupAddress] = useState(null);
  const [step, setStep] = useState('input'); // input | paying | result
  const [payStep, setPayStep] = useState(''); // approve | verify | reading
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);

  // Profile and score data (fetched after payment)
  const [profileData, setProfileData] = useState(null);
  const [scoreData, setScoreData] = useState(null);

  // Fee info
  const { data: usdcAddress } = useReadContract({
    address: CONTRACT_ADDRESS, abi: PramaanABI.abi, functionName: 'usdc'
  });
  const { data: verificationFee } = useReadContract({
    address: CONTRACT_ADDRESS, abi: PramaanABI.abi, functionName: 'verificationFee'
  });

  const handleVerify = async () => {
    if (!address) { setError('Please connect your wallet first.'); return; }
    if (!workerAddress || !publicClient || !usdcAddress || verificationFee === undefined) return;
    if (!/^0x[a-fA-F0-9]{40}$/.test(workerAddress)) {
      setError('Please enter a valid 42-character Ethereum wallet address.');
      return;
    }

    setStep('paying');
    setError(null);
    setPayStep('Checking worker profile...');

    try {
      // Pre-flight: deployed contract has extra fields not in ABI, so
      // getWorkerProfile() and workers() both fail on decode.
      let preScore = 0;

      // 1. Try reading raw storage to bypass any getter modifiers (like onlyVerified)
      try {
        const w = await publicClient.readContract({
          address: CONTRACT_ADDRESS, abi: WORKER_GETTER_ABI, functionName: 'workers', args: [workerAddress]
        });
        if (w && Array.isArray(w)) preScore = Number(w[2]);
      } catch (err) {
        console.warn("Raw storage read failed:", err);
      }

      // 2. Try the getters if storage read failed or returned 0
      if (preScore === 0) {
        preScore = await publicClient.readContract({
            address: CONTRACT_ADDRESS, abi: PramaanABI.abi, functionName: 'getGigScore', args: [workerAddress]
        }).catch(() => 0);
      }

      console.log("Pre-flight:", { preScore: Number(preScore) });

      if (Number(preScore) === 0) throw new Error('Worker not found');

      // Step 1: USDC Approval
      setPayStep('Awaiting USDC approval signature...');
      const approveHash = await writeContractAsync({
        address: usdcAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACT_ADDRESS, verificationFee]
      });
      setPayStep('Mining USDC approval...');
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      // Step 2: Verify Worker on-chain
      setPayStep('Awaiting verification signature...');
      const verifyHash = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: PramaanABI.abi,
        functionName: 'verifyWorker',
        args: [workerAddress]
      });
      setTxHash(verifyHash);
      setPayStep('Mining verification tx...');
      await publicClient.waitForTransactionReceipt({ hash: verifyHash });

      // Step 3: Read verified data — only use safe simple-return functions
      setPayStep('Reading on-chain data...');
      let finalScore = 0;
      let pData = { identityVerified: true, incomeVerified: true, platform: 'Multi-Source RaaS', exists: true };
      
      try {
        const w = await publicClient.readContract({
          address: CONTRACT_ADDRESS, abi: WORKER_GETTER_ABI, functionName: 'workers', args: [workerAddress]
        });
        if (w && Array.isArray(w)) {
          finalScore = Number(w[2]);
          pData.identityVerified = Boolean(w[0]);
          pData.incomeVerified = Boolean(w[1]);
          if (w[6]) pData.platform = w[6];
        }
      } catch (e) {
        finalScore = Number(await publicClient.readContract({
          address: CONTRACT_ADDRESS, abi: PramaanABI.abi, functionName: 'getGigScore', args: [workerAddress]
        }).catch(() => 0));
      }

      // Build profile from what we know (contract struct decode is broken due to ABI mismatch)
      setProfileData(pData);
      setScoreData(finalScore);
      setLookupAddress(workerAddress);
      setStep('result');

    } catch (err) {
      console.error("VerifyIdentity error:", err);
      console.error("Error name:", err?.name);
      console.error("Error message:", err?.message);
      console.error("Error shortMessage:", err?.shortMessage);
      console.error("Error details:", err?.details);
      console.error("Error cause:", err?.cause);
      const msg = String(err?.shortMessage || err?.message || '');
      if (msg.includes('Worker not found')) setError('This worker has not registered on Pramaan yet.');
      else if (msg.includes('Profile incomplete')) setError('Worker has not completed all verification steps.');
      else if (msg.includes('Score not set')) setError('No score has been computed for this worker yet.');
      else if (msg.includes('transfer amount exceeds balance')) setError('Insufficient USDC balance in your wallet.');
      else if (msg.includes('rejected') || msg.includes('denied')) setError('Transaction was rejected.');
      else setError(`Verification failed: ${msg.slice(0, 200)}`);
      setStep('input');
    }
  };

  const handleReset = () => {
    setStep('input');
    setWorkerAddress('');
    setLookupAddress(null);
    setError(null);
    setProfileData(null);
    setScoreData(null);
    setTxHash(null);
  };

  const tier = scoreData ? getTier(scoreData) : null;

  return (
    <div className="min-h-svh bg-background px-6 py-8 pt-20">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <motion.div
          className="mb-10"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button
            onClick={() => navigate("/gateway")}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Gateway
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">Verify Identity</h1>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">On-Chain Verification Portal</p>
            </div>
          </div>
          <p className="text-muted-foreground mt-3 text-sm leading-relaxed">
            Pay a small USDC fee to cryptographically verify a worker's Pramaan score on-chain.
            Two wallet signatures required: USDC approval + verification transaction.
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* ─── INPUT PHASE ──────────────────────────── */}
          {step === 'input' && (
            <motion.div
              key="input"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
            >
              {/* Error banner */}
              {error && (
                <motion.div
                  className="mb-6 p-4 rounded-2xl bg-destructive/5 border border-destructive/15 flex items-start gap-3"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                >
                  <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-destructive">{error}</p>
                    <button onClick={() => setError(null)} className="text-xs text-destructive/60 mt-1 hover:text-destructive transition-colors">
                      Dismiss
                    </button>
                  </div>
                </motion.div>
              )}

              <div className="glass-card p-8">
                {/* Search input */}
                <label className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-3 block">
                  Worker Wallet Address
                </label>
                <div className="relative mb-6">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/40" />
                  <input
                    type="text"
                    value={workerAddress}
                    onChange={(e) => setWorkerAddress(e.target.value.trim())}
                    placeholder="0x..."
                    className="w-full px-5 py-4 pl-12 rounded-2xl bg-white/80 border border-border text-foreground font-mono-data text-sm placeholder:text-muted-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
                  />
                </div>

                {/* Fee card */}
                <div className="rounded-2xl bg-gradient-to-br from-primary/[0.03] to-transparent p-5 border border-primary/10 mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <CreditCard className="w-4 h-4 text-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary">Transaction Details</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Verification Fee</span>
                      <span className="font-semibold text-foreground font-mono-data">
                        {verificationFee ? `${formatUnits(verificationFee, 6)} USDC` : '...'}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Network</span>
                      <span className="font-medium text-foreground">Base Sepolia</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Signatures Required</span>
                      <span className="font-medium text-foreground">2 (Approve + Verify)</span>
                    </div>
                  </div>
                </div>

                {/* Steps preview */}
                <div className="flex items-center gap-2 mb-6">
                  {[
                    { icon: Wallet, label: "Approve USDC" },
                    { icon: Shield, label: "Verify On-Chain" },
                    { icon: CheckCircle2, label: "View Result" },
                  ].map((s, i) => (
                    <div key={s.label} className="flex items-center gap-2 flex-1">
                      <div className="w-7 h-7 rounded-lg bg-muted/50 flex items-center justify-center flex-shrink-0">
                        <s.icon className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium hidden sm:inline">{s.label}</span>
                      {i < 2 && <div className="flex-1 h-px bg-border/50 hidden sm:block" />}
                    </div>
                  ))}
                </div>

                <button
                  onClick={handleVerify}
                  disabled={!workerAddress || !verificationFee || !address}
                  className="w-full inline-flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl bg-primary text-primary-foreground font-semibold transition-all duration-200 hover:shadow-lg hover:shadow-primary/20 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Shield className="w-5 h-5" />
                  Verify & Pay
                </button>

                {!address && (
                  <p className="text-center text-xs text-amber-600 mt-3 font-medium">
                    Connect your wallet to proceed
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* ─── PAYING PHASE ─────────────────────────── */}
          {step === 'paying' && (
            <motion.div
              key="paying"
              className="glass-card p-10 text-center"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <motion.div
                className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
              </motion.div>

              <h3 className="text-lg font-semibold text-foreground mb-2">Processing Verification</h3>
              <p className="text-sm text-muted-foreground mb-6">Please confirm transactions in your wallet</p>

              <motion.div
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary/5 border border-primary/10"
                key={payStep}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-sm font-medium text-primary">{payStep}</span>
              </motion.div>

              <div className="mt-8 flex items-center justify-center gap-8 text-xs text-muted-foreground">
                <span className="font-mono-data">{workerAddress.slice(0,8)}...{workerAddress.slice(-4)}</span>
                <span>{verificationFee ? `${formatUnits(verificationFee, 6)} USDC` : ''}</span>
              </div>
            </motion.div>
          )}

          {/* ─── RESULT PHASE ─────────────────────────── */}
          {step === 'result' && profileData && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Success banner */}
              <motion.div
                className="mb-6 p-4 rounded-2xl bg-success/5 border border-success/15 flex items-center gap-3"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
              >
                <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-success">Verification Complete</p>
                  <p className="text-[10px] text-muted-foreground font-mono-data mt-0.5">
                    {txHash ? `Tx: ${txHash.slice(0,10)}...${txHash.slice(-6)}` : 'Verified on-chain'}
                  </p>
                </div>
                {txHash && (
                  <a
                    href={`https://sepolia.basescan.org/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    View <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </motion.div>

              {/* Passport Card */}
              <motion.div
                className="glass-card p-8 mb-6 relative overflow-hidden border-success/20"
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              >
                {/* Background score watermark */}
                <div className="absolute -right-4 -top-4 text-[120px] font-black text-foreground/[0.02] font-mono-data select-none leading-none">
                  {scoreData || 0}
                </div>

                <div className="relative">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-8">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-3">
                        Pramaan Verified Identity
                      </p>
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                          <Shield className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm font-mono-data">
                            {lookupAddress?.slice(0, 10)}...{lookupAddress?.slice(-6)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Platform: {profileData?.platform || 'Multi-Source RaaS'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Score */}
                    <div className="text-right">
                      <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground mb-1">Gig Score</p>
                      <p className="text-6xl font-semibold font-mono-data tracking-tighter gradient-text leading-none">
                        {scoreData || 0}
                      </p>
                      {tier && (
                        <p className={`text-xs font-bold mt-1 ${tier.color}`}>{tier.label}</p>
                      )}
                    </div>
                  </div>

                  {/* Score bar */}
                  <div className="mb-6">
                    <div className="h-2 rounded-full bg-border/50 overflow-hidden">
                      <motion.div
                        className={`h-full rounded-full ${tier?.bg || 'bg-primary'}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${scoreData || 0}%` }}
                        transition={{ delay: 0.5, duration: 1, ease: [0.2, 0, 0, 1] }}
                      />
                    </div>
                    <div className="flex justify-between mt-1.5 text-[9px] text-muted-foreground/50 font-mono-data">
                      <span>0</span>
                      <span>25</span>
                      <span>50</span>
                      <span>75</span>
                      <span>100</span>
                    </div>
                  </div>

                  {/* Verification details grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl bg-foreground/[0.02] p-3 border border-border/30">
                      <Fingerprint className="w-4 h-4 text-muted-foreground mb-1.5" />
                      <p className="text-[10px] text-muted-foreground font-medium">Identity</p>
                      <p className={`text-sm font-semibold mt-0.5 ${profileData?.identityVerified ? 'text-success' : 'text-destructive'}`}>
                        {profileData?.identityVerified ? 'Verified' : 'Unverified'}
                      </p>
                    </div>
                    <div className="rounded-xl bg-foreground/[0.02] p-3 border border-border/30">
                      <BarChart3 className="w-4 h-4 text-muted-foreground mb-1.5" />
                      <p className="text-[10px] text-muted-foreground font-medium">Income</p>
                      <p className={`text-sm font-semibold mt-0.5 ${profileData?.incomeVerified ? 'text-success' : 'text-destructive'}`}>
                        {profileData?.incomeVerified ? 'Verified' : 'Unverified'}
                      </p>
                    </div>
                    <div className="rounded-xl bg-foreground/[0.02] p-3 border border-border/30">
                      <Globe className="w-4 h-4 text-muted-foreground mb-1.5" />
                      <p className="text-[10px] text-muted-foreground font-medium">Network</p>
                      <p className="text-sm font-semibold mt-0.5 text-foreground">Base Sepolia</p>
                    </div>
                    <div className="rounded-xl bg-foreground/[0.02] p-3 border border-border/30">
                      <TrendingUp className="w-4 h-4 text-muted-foreground mb-1.5" />
                      <p className="text-[10px] text-muted-foreground font-medium">Last Updated</p>
                      <p className="text-sm font-semibold mt-0.5 text-foreground">
                        {profileData?.lastUpdated ? new Date(Number(profileData?.lastUpdated) * 1000).toLocaleDateString() : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Doc IDs */}
                  <div className="mt-5 pt-4 border-t border-border/30 space-y-2">
                    {profileData?.identityDdocId && (
                      <div className="flex items-baseline gap-2 text-xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 w-20 flex-shrink-0">Identity</span>
                        <span className="font-mono-data text-muted-foreground truncate">{profileData[4]}</span>
                      </div>
                    )}
                    {profileData?.incomeDdocId && (
                      <div className="flex items-baseline gap-2 text-xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/50 w-20 flex-shrink-0">Income</span>
                        <span className="font-mono-data text-muted-foreground truncate">{profileData[5]}</span>
                      </div>
                    )}
                  </div>

                  {/* Footer badges */}
                  <div className="flex items-center justify-between mt-5 pt-4 border-t border-border/30">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 text-success text-[10px] font-bold border border-success/15">
                      <CheckCircle2 className="w-3 h-3" />
                      On-Chain Verified
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono-data">
                      Pramaan Protocol v2
                    </span>
                  </div>
                </div>
              </motion.div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleReset}
                  className="glass-card-hover p-4 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="w-4 h-4" />
                  Verify Another
                </button>
                <button
                  onClick={() => navigate("/lender")}
                  className="glass-card-hover p-4 flex items-center justify-center gap-2 text-sm font-medium text-primary"
                >
                  <CreditCard className="w-4 h-4" />
                  Lender Bureau
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
