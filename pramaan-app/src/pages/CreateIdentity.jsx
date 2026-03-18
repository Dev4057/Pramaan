import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, ArrowRight, Shield, Fingerprint, BarChart3, ExternalLink, Bot, Sparkles } from "lucide-react";
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
  const [finalProfile, setFinalProfile] = useState(null);

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
      return { 
        identityVerified: data[0], 
        incomeVerified: data[1], 
        platform: data[6],
        identityDdocId: data[4],
        incomeDdocId: data[5]
      };
    } catch (err) {
      try {
        // Fallback to legacy ABI
        const data = await publicClient.readContract({
          address: CONTRACT_ADDRESS, abi: PramaanABI.abi, functionName: 'workers', args: [address]
        });
        return { 
          identityVerified: data[0], 
          incomeVerified: data[1], 
          platform: data[6],
          identityDdocId: data[4],
          incomeDdocId: data[5]
        };
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

          // FETCH THE FINAL ON-CHAIN DATA FOR THE PASSPORT
          getSafeProfile().then(p => setFinalProfile(p)); 

          setTimeout(() => {
            setPhase("complete");
          }, 1000);
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

{/* --- PHASE 3: THE PIPELINE (Only shows during processing) --- */}
          {phase === "processing" && (
            <motion.div 
              key="pipeline" 
              className="w-full max-w-5xl mx-auto" 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)", transition: { duration: 0.4 } }}
            >
              <h1 className="text-3xl font-bold mb-12 text-center text-foreground">
                Minting your Pramaan Identity...
              </h1>

              {/* THE 4-BOX PIPELINE */}
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                
                {/* Box 1: Identity */}
                <div className="glass-card p-6 flex-1 w-full text-center border-success/30 shadow-lg shadow-success/5">
                  <Fingerprint className="w-8 h-8 text-success mx-auto mb-3" />
                  <p className="font-semibold text-foreground">Identity</p>
                  <p className="text-xs text-success font-medium mt-1 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3 h-3"/> ZK Verified
                  </p>
                </div>

                <ArrowRight className="w-6 h-6 text-muted-foreground/50 rotate-90 md:rotate-0 flex-shrink-0" />

                {/* Box 2: Income */}
                <div className="glass-card p-6 flex-1 w-full text-center border-success/30 shadow-lg shadow-success/5">
                  <BarChart3 className="w-8 h-8 text-success mx-auto mb-3" />
                  <p className="font-semibold text-foreground">Income</p>
                  <p className="text-xs text-success font-medium mt-1 flex items-center justify-center gap-1">
                    <CheckCircle2 className="w-3 h-3"/> On-Chain
                  </p>
                </div>

                <ArrowRight className="w-6 h-6 text-muted-foreground/50 rotate-90 md:rotate-0 flex-shrink-0" />

                {/* Box 3: The Pramaan Agent (Pulsing Animation) */}
                <motion.div 
                  className="glass-card p-6 flex-1 w-full text-center border-primary/50 shadow-primary/20"
                  animate={{ opacity: [0.4, 1, 0.4], scale: [0.98, 1.02, 0.98] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                >
                  <Bot className="w-8 h-8 mx-auto mb-3 text-primary" />
                  <p className="font-semibold text-primary">Pramaan Agent</p>
                  <p className="text-xs font-medium mt-1 text-primary/70">x402 Negotiating...</p>
                </motion.div>

                <ArrowRight className="w-6 h-6 text-muted-foreground/50 rotate-90 md:rotate-0 flex-shrink-0" />

                {/* Box 4: The Spinning Score */}
                <div className="glass-card p-6 flex-1 w-full text-center border-border">
                  <Shield className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1 font-semibold">Gig Score</p>
                  <p className="text-5xl font-black tabular-nums tracking-tighter text-primary">
                    {displayScore}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

         {/* --- PHASE 4: THE SUCCESS PASSPORT (Slim & Sleek Version) --- */}
          {phase === "complete" && (
            <motion.div 
              key="complete" 
              className="w-full max-w-md mx-auto" 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              transition={{ delay: 0.2, type: "spring", stiffness: 120 }}
            >
              <div className="text-center mb-8">
                <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-6 h-6 text-success" />
                </div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">Passport Verified</h1>
              </div>

              {/* The Slim Premium Passport Card */}
              <div className="glass-card p-8 mb-8 border-success/30 shadow-xl shadow-success/5 relative overflow-hidden text-left bg-gradient-to-br from-background to-success/5">
                 <div className="flex justify-between items-start mb-8">
                   <div className="bg-[#FFF9C4]/80 dark:bg-[#FFF9C4]/20 p-3 rounded-xl border border-yellow-200/50 backdrop-blur-sm shadow-sm inline-block">
                     <h2 className="text-base md:text-lg font-black uppercase tracking-[0.2em] text-success mb-1 drop-shadow-sm">Pramaan</h2>
                     <p className="text-[10px] md:text-xs text-muted-foreground font-bold uppercase tracking-widest">Digital Passport</p>
                   </div>
                   <div className="text-right">
                     <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">Gig Score</p>
                     <p className="text-5xl font-black tracking-tighter tabular-nums text-foreground">{gigScore}</p>
                   </div>
                 </div>
                 
                 <div className="space-y-4">
                   <div>
                     <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Verified Wallet</p>
                     <p className="text-sm font-mono-data text-foreground/80">{address?.slice(0,8)}...{address?.slice(-6)}</p>
                   </div>
                   
                   <div className="pt-4 border-t border-border/40 flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                      <span className="text-[10px] font-bold text-success uppercase tracking-wider">On-Chain Minted</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">{finalProfile?.platform || 'SBI'} Network</p>
                   </div>
                 </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}