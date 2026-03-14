import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, ArrowRight, Shield, Fingerprint, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { LogInWithAnonAadhaar, useAnonAadhaar, useProver } from '@anon-aadhaar/react';
import QRCode from 'react-qr-code';
import PramaanABI from '../abi/Pramaan.json';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
const ANON_NULLIFIER_SEED = import.meta.env.VITE_ANON_NULLIFIER_SEED || '1234';

// SAFE ABI TO PREVENT DECODING ERRORS FROM ZK FIELDS
const WORKER_GETTER_ABI = [{
  type: 'function', name: 'workers', stateMutability: 'view', inputs: [{ name: '', type: 'address' }],
  outputs: [
    { name: 'identityVerified', type: 'bool' }, { name: 'incomeVerified', type: 'bool' },
    { name: 'gigScore', type: 'uint8' }, { name: 'lastUpdated', type: 'uint256' },
    { name: 'identityDdocId', type: 'string' }, { name: 'incomeDdocId', type: 'string' },
    { name: 'platform', type: 'string' }, { name: 'identityProofHash', type: 'string' },
    { name: 'incomeProofHash', type: 'string' }, { name: 'identityNullifier', type: 'bytes32' },
    { name: 'incomeNullifier', type: 'bytes32' }, { name: 'identityCommitment', type: 'bytes32' },
    { name: 'incomeCommitment', type: 'bytes32' }, { name: 'exists', type: 'bool' }
  ]
}];

export default function CreateIdentity() {
  const navigate = useNavigate();
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [anonAadhaar] = useAnonAadhaar();
  const [, latestProof] = useProver();

  const [phase, setPhase] = useState("identity");
  const [step1Done, setStep1Done] = useState(false);
  const [step2Done, setStep2Done] = useState(false);
  const [gigScore, setGigScore] = useState(null);
  const [displayScore, setDisplayScore] = useState(0);

  const [identityQR, setIdentityQR] = useState(null);
  const [selectedProvider, setSelectedProvider] = useState('sbi');
  const [loadingAction, setLoadingAction] = useState(false);
  const [error, setError] = useState(null);

  // Helper to safely read profile without ABI crashing
  async function getSafeProfile() {
    if (!publicClient || !address) return null;
    try {
      // Try extended ZK ABI first
      const data = await publicClient.readContract({
        address: CONTRACT_ADDRESS, abi: WORKER_GETTER_ABI, functionName: 'workers', args: [address]
      });
      return { identityVerified: data[0], incomeVerified: data[1], platform: data[6] };
    } catch (err) {
      try {
        // Fallback to legacy ABI
        const data = await publicClient.readContract({
          address: CONTRACT_ADDRESS, abi: PramaanABI.abi, functionName: 'workers', args: [address]
        });
        return { identityVerified: data[0], incomeVerified: data[1], platform: data[6] };
      } catch (e) {
        return null;
      }
    }
  }

  // Safely estimate gas to prevent the 21M gas limit error
  async function getSafeGasLimit(functionName, args) {
    const fallbackGas = 900000n;
    if (!publicClient || !address) return fallbackGas;
    try {
      const estimated = await publicClient.estimateContractGas({
        account: address, address: CONTRACT_ADDRESS, abi: PramaanABI.abi, functionName, args
      });
      return (estimated * 120n) / 100n;
    } catch (err) {
      console.warn('Gas estimation failed, using fallback:', err);
      return fallbackGas;
    }
  }

  async function hashAnonProof(proof, walletAddress) {
    const payload = JSON.stringify({
      walletAddress: (walletAddress || '').toLowerCase(),
      nullifier: proof.nullifier, timestamp: proof.timestamp, ageAbove18: proof.ageAbove18 ?? proof.revealAgeAbove18 ?? 0
    });
    const bytes = new TextEncoder().encode(payload);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return `anon:${Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')}`;
  }

  // --- STEP 1: REAL IDENTITY (Anon Aadhaar) ---
  const handleSubmitAnonIdentity = async () => {
    if (!latestProof?.proof || !address || anonAadhaar?.status !== 'logged-in') {
      setError('Complete Anon Aadhaar login first.');
      return;
    }
    setLoadingAction(true); setError(null);

    try {
      const profile = await getSafeProfile();

      if (profile && profile.identityVerified) {
        setStep1Done(true);
        setPhase("income");
        setLoadingAction(false);
        return;
      }

      const proofHash = await hashAnonProof(latestProof.proof, address);
      
      const isUsed = await publicClient.readContract({
         address: CONTRACT_ADDRESS, abi: PramaanABI.abi, functionName: 'usedProofHashes', args: [proofHash]
      }).catch(() => false);

      if (isUsed) throw new Error("This Anon Aadhaar proof has already been used.");

      const ddocId = `anon-aadhaar:${address.toLowerCase()}:${Date.now()}`;
      const gas = await getSafeGasLimit('submitIdentity', [ddocId, proofHash]); 

      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS, abi: PramaanABI.abi, functionName: 'submitIdentity', args: [ddocId, proofHash], gas 
      });
      await publicClient.waitForTransactionReceipt({ hash });
      
      setStep1Done(true);
      setPhase("income");
    } catch (err) {
      console.error(err);
      setError(err?.shortMessage || err?.message || 'Identity submission failed');
    }
    setLoadingAction(false);
  };

  const handleGenerateIdentityQR = async () => {
    setLoadingAction(true); setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/reclaim/identity-request`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ walletAddress: address })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setIdentityQR(data.requestUrl);
    } catch (err) { setError(err.message); }
    setLoadingAction(false);
  };

  useEffect(() => {
    if (!identityQR || step1Done) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/reclaim/status/identity/${address}`);
        const data = await res.json();
        if (data.ready) {
          clearInterval(interval);
          setIdentityQR(null);
          const gas = await getSafeGasLimit('submitIdentity', [data.ddocId, data.proofHash]);
          const hash = await writeContractAsync({
            address: CONTRACT_ADDRESS, abi: PramaanABI.abi, functionName: 'submitIdentity', args: [data.ddocId, data.proofHash], gas
          });
          await publicClient.waitForTransactionReceipt({ hash });
          setStep1Done(true);
          setPhase("income");
        }
      } catch (err) { console.error(err); }
    }, 3000);
    return () => clearInterval(interval);
  }, [identityQR, step1Done, address]);


  // --- STEP 2: MOCK INCOME ---
  const handleVerifyMockIncome = async () => {
    setLoadingAction(true); setError(null);

    try {
      const profile = await getSafeProfile();

      if (profile && profile.incomeVerified) {
        setStep2Done(true);
        setPhase("processing");
        generateGigScore(profile.platform || selectedProvider);
        return;
      }

      const res = await fetch(`${BACKEND_URL}/api/mock/income-verify/${address}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: selectedProvider })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Mock income verification failed');

      setPhase("processing"); 

      const gas = await getSafeGasLimit('submitIncome', [data.ddocId, data.platform, data.proofHash]); 
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESS, abi: PramaanABI.abi, functionName: 'submitIncome', args: [data.ddocId, data.platform, data.proofHash], gas 
      });
      await publicClient.waitForTransactionReceipt({ hash });
      
      setStep2Done(true);
      generateGigScore(data.platform);
    } catch (err) {
      console.error(err);
      setError(err?.shortMessage || err?.message || 'Income submission failed');
      setPhase("income"); 
    }
    setLoadingAction(false);
  };

  // --- STEP 3: REAL SCORING ---
  const generateGigScore = async (platform) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/agent/score/${address}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform: platform || 'SBI' })
      });
      const data = await res.json();
      const finalScore = data.score || 750;
      
      setGigScore(finalScore);

      const duration = 2000;
      const start = Date.now();
      const interval = setInterval(() => {
        const elapsed = Date.now() - start;
        if (elapsed >= duration) {
          setDisplayScore(finalScore);
          clearInterval(interval);
          setTimeout(() => setPhase("complete"), 1000);
        } else {
          setDisplayScore(Math.floor(Math.random() * 900 + 100));
        }
      }, 50);

    } catch (err) {
      setError('Score assignment failed: ' + err.message);
    }
  };

  return (
    <div className="min-h-svh bg-background flex items-center justify-center px-6 py-24">
      <div className="max-w-xl w-full">
        <button onClick={() => navigate("/gateway")} className="mb-8 text-sm text-muted-foreground hover:text-foreground transition-colors">
          ← Back to Gateway
        </button>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-destructive/10 text-destructive text-sm border border-destructive/20 text-center">
            {error}
          </div>
        )}

        <AnimatePresence mode="wait">
          
          {/* PHASE 1: REAL IDENTITY */}
          {phase === "identity" && (
            <motion.div key="identity" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4 }}>
              <p className="text-sm text-primary font-medium uppercase tracking-wider mb-3">Step 1</p>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground mb-2">Prove Your Identity</h1>
              <p className="text-muted-foreground mb-8 text-pretty">Securely verify you are over 18 using Anon Aadhaar (ZK-Proof) or DigiLocker.</p>

              <div className="glass-card p-6 flex flex-col gap-6">
                <div className="flex flex-col items-center gap-4 p-4 rounded-xl border border-border bg-white/50">
                  <p className="text-sm font-medium">Option A: Zero-Knowledge Proof</p>
                  <LogInWithAnonAadhaar nullifierSeed={ANON_NULLIFIER_SEED} fieldsToReveal={['revealAgeAbove18']} signal={address || '0x0'} />
                  {anonAadhaar?.status === 'logged-in' && (
                    <button onClick={handleSubmitAnonIdentity} disabled={loadingAction} className="w-full mt-2 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition shadow-lg shadow-primary/20">
                      {loadingAction ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Submit Proof On-Chain"}
                    </button>
                  )}
                </div>

                <div className="relative flex py-2 items-center">
                  <div className="flex-grow border-t border-border"></div>
                  <span className="flex-shrink-0 mx-4 text-muted-foreground text-xs">OR</span>
                  <div className="flex-grow border-t border-border"></div>
                </div>

                <div className="flex flex-col items-center gap-4">
                  {!identityQR ? (
                    <button onClick={handleGenerateIdentityQR} disabled={loadingAction} className="w-full py-3 rounded-xl bg-secondary text-secondary-foreground font-medium border border-border hover:brightness-95 transition">
                      {loadingAction ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Generate Reclaim QR (DigiLocker)"}
                    </button>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-xs text-muted-foreground mb-4">Scan with your phone to prove identity</p>
                      <div className="bg-white p-4 rounded-xl inline-block shadow-sm">
                        <QRCode value={identityQR} size={180} />
                      </div>
                      <p className="text-xs text-primary animate-pulse mt-4">Waiting for proof...</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* PHASE 2: MOCK INCOME */}
          {phase === "income" && (
            <motion.div key="income" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4 }}>
              <p className="text-sm text-primary font-medium uppercase tracking-wider mb-3">Step 2</p>
              <h1 className="text-2xl sm:text-3xl font-semibold text-foreground mb-2">Connect Platform</h1>
              <p className="text-muted-foreground mb-8 text-pretty">Select your primary source of gig income to verify your consistent earnings history.</p>

              <div className="glass-card p-6">
                <div className="flex gap-4 mb-6">
                  <button onClick={() => setSelectedProvider('sbi')} className={`flex-1 py-4 rounded-xl text-sm font-medium border transition-all ${selectedProvider === 'sbi' ? 'bg-primary/10 border-primary text-primary shadow-sm' : 'bg-transparent border-border text-muted-foreground hover:bg-muted'}`}>
                    SBI Bank
                  </button>
                  <button onClick={() => setSelectedProvider('uber')} className={`flex-1 py-4 rounded-xl text-sm font-medium border transition-all ${selectedProvider === 'uber' ? 'bg-primary/10 border-primary text-primary shadow-sm' : 'bg-transparent border-border text-muted-foreground hover:bg-muted'}`}>
                    Uber
                  </button>
                </div>
                <button onClick={handleVerifyMockIncome} disabled={loadingAction} className="w-full py-4 rounded-xl bg-primary text-white font-medium hover:brightness-95 transition shadow-lg shadow-primary/20">
                  {loadingAction ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : `Verify ${selectedProvider.toUpperCase()} On-Chain`}
                </button>
              </div>
            </motion.div>
          )}

          {/* PHASE 3: PROCESSING / SCORING */}
          {phase === "processing" && (
            <motion.div key="processing" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              <h1 className="text-2xl sm:text-3xl font-semibold text-foreground mb-2 text-center">Building your identity</h1>
              <p className="text-muted-foreground mb-10 text-center">Validating your credentials securely...</p>

              <div className="space-y-3 mb-10 max-w-sm mx-auto">
                <div className="flex items-center gap-4 glass-card p-4">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Identity Verification</p>
                    <p className="text-xs text-muted-foreground">Verified on-chain</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 glass-card p-4">
                  {step2Done ? <CheckCircle2 className="w-5 h-5 text-success" /> : <Loader2 className="w-5 h-5 text-primary animate-spin" />}
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${step2Done ? 'text-foreground' : 'text-primary'}`}>Income Validation</p>
                    <p className="text-xs text-muted-foreground">Cross-referencing signals</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 glass-card p-4">
                  {gigScore ? <CheckCircle2 className="w-5 h-5 text-success" /> : <Loader2 className="w-5 h-5 text-primary animate-spin" />}
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${gigScore ? 'text-foreground' : 'text-primary'}`}>Gig Score Generation</p>
                    <p className="text-xs text-muted-foreground">AI computing credibility score</p>
                  </div>
                </div>
              </div>

              {step2Done && (
                <motion.div className="text-center" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Your Score</p>
                  <motion.p className="text-6xl font-semibold font-mono-data tracking-tight text-foreground" animate={{ scale: displayScore === gigScore ? [0.9, 1.1, 1] : 1 }}>
                    {displayScore}
                  </motion.p>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* PHASE 4: COMPLETE (PASSPORT) */}
          {phase === "complete" && (
            <motion.div key="complete" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center">
              <motion.div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6" initial={{ scale: 0 }} animate={{ scale: 1 }}>
                <CheckCircle2 className="w-8 h-8 text-success" />
              </motion.div>

              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground mb-2">Your Pramaan Identity is Ready</h1>
              <p className="text-muted-foreground mb-10">Identity Verified. Your Gig Score is now portable.</p>

              <div className="glass-card p-8 text-left max-w-sm mx-auto mb-8 border-success/20">
                <div className="flex items-center justify-between mb-6">
                  <div><p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Pramaan Passport</p></div>
                  <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/10 text-success text-xs font-medium border border-success/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-success" /> Verified
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Wallet</p>
                    <p className="text-sm font-medium font-mono-data text-foreground">{address?.slice(0,6)}...{address?.slice(-4)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Gig Score</p>
                    <p className="text-2xl font-semibold font-mono-data text-foreground">{gigScore}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/60">
                  <div>
                    <p className="text-xs text-muted-foreground">Income Verified</p>
                    <p className="text-xs text-success font-medium mt-0.5">✓ Confirmed</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Aadhaar Linked</p>
                    <p className="text-xs text-success font-medium mt-0.5">✓ Confirmed</p>
                  </div>
                </div>
              </div>

              <button onClick={() => navigate("/verify")} className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-medium transition-all duration-200 ease-out hover:brightness-95 hover:shadow-lg active:scale-95">
                View Identity <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}