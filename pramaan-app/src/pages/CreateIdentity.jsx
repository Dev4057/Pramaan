import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, ArrowRight, Shield, Fingerprint, BarChart3, ExternalLink, Bot, Sparkles, Github, Car, Landmark, Linkedin, Users, Code, Briefcase, Plus, Twitter, Tv, MessageCircle, ShoppingCart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';
import { LogInWithAnonAadhaar, useAnonAadhaar, useProver } from '@anon-aadhaar/react';
import { QRCode } from 'react-qr-code';
import PramaanABI from '../abi/Pramaan.json';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
const ANON_NULLIFIER_SEED = import.meta.env.VITE_ANON_NULLIFIER_SEED || '1234';

// NOTE: workers() and getWorkerProfile() fail due to ABI/storage layout mismatch
// on the deployed contract. Use getGigScore() and isVerified() instead.

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
  const [selectedProvider, setSelectedProvider] = useState('github');
  const [loadingAction, setLoadingAction] = useState(false);
  const [error, setError] = useState(null);
  const [reclaimIncomeQR, setReclaimIncomeQR] = useState(null);

  // RaaS multi-provider state
  const [availableProviders, setAvailableProviders] = useState([]);
  const [verifiedProviders, setVerifiedProviders] = useState({});   // { github: { score: 60, metric: 422 }, ... }
  const [activeVerifyProvider, setActiveVerifyProvider] = useState(null);  // provider key currently being verified
  const [activeVerifyQR, setActiveVerifyQR] = useState(null);       // QR URL for active verification
  const [scoreBreakdown, setScoreBreakdown] = useState(null);       // composite score result
  const [failedProvider, setFailedProvider] = useState(null);       // provider key that failed (for demo fallback)

  // Helper to safely read profile — uses only simple-return functions
  // because workers()/getWorkerProfile() fail due to ABI mismatch with deployed contract
  async function getSafeProfile() {
    if (!publicClient || !address) return null;
    try {
      const [isVerified, gigScore] = await Promise.all([
        publicClient.readContract({
          address: CONTRACT_ADDRESS, abi: PramaanABI.abi,
          functionName: 'isVerified', args: [address]
        }).catch(() => false),
        publicClient.readContract({
          address: CONTRACT_ADDRESS, abi: PramaanABI.abi,
          functionName: 'getGigScore', args: [address]
        }).catch(() => 0),
      ]);
      // isVerified returns true only if exists && identityVerified && incomeVerified
      if (!isVerified && Number(gigScore) === 0) return null;
      return {
        identityVerified: isVerified,
        incomeVerified: isVerified,
        gigScore: Number(gigScore),
        platform: 'Multi-Source RaaS',
        exists: true,
      };
    } catch (e) {
      console.warn('[getSafeProfile] failed:', e.message);
      return null;
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

  // Fetch available providers on mount
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/providers`)
      .then(r => r.json())
      .then(data => {
        console.log('[PROVIDERS] Fetched:', data);
        if (data.ok && data.providers) setAvailableProviders(data.providers);
      })
      .catch(err => console.error('[PROVIDERS] Fetch failed:', err));
  }, []);

  // Auto-skip identity step if already verified on-chain
  useEffect(() => {
    if (phase !== 'identity' || step1Done || !publicClient || !address) return;
    getSafeProfile().then(profile => {
      if (profile?.identityVerified) {
        console.log('[AUTO-SKIP] Identity already verified on-chain, jumping to providers');
        setStep1Done(true);
        setPhase("income");
      }
    }).catch(() => {});
  }, [phase, address, publicClient]);

  // Start verification for a specific provider
  const startProviderVerification = async (providerKey) => {
    setLoadingAction(true); setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/reclaim/verify/${providerKey}/${address}`, { method: 'POST' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setActiveVerifyProvider(providerKey);
      setActiveVerifyQR(data.requestUrl);
    } catch (err) { setError(err.message); }
    setLoadingAction(false);
  };

  // Demo fallback — only when Reclaim attestor fails
  const useDemoData = async (providerKey) => {
    setLoadingAction(true); setError(null); setFailedProvider(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/demo/provider-verify/${providerKey}/${address}`, { method: 'POST' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setVerifiedProviders(prev => ({
        ...prev,
        [providerKey]: { score: data.score, metric: data.metric, providerName: data.providerName, isDemo: true }
      }));
      console.log(`[DEMO] ${providerKey} verified with demo data: score=${data.score}`);
    } catch (err) { setError(err.message); }
    setLoadingAction(false);
  };

  // Poll for provider proof completion
  useEffect(() => {
    if (!activeVerifyProvider || !activeVerifyQR || !address) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/reclaim/proof-status/${activeVerifyProvider}/${address}`);
        const data = await res.json();
        if (data.ready) {
          clearInterval(interval);
          setVerifiedProviders(prev => ({
            ...prev,
            [activeVerifyProvider]: { score: data.score, metric: data.metric, providerName: data.providerName }
          }));
          setActiveVerifyProvider(null);
          setActiveVerifyQR(null);
        } else if (data.failed) {
          clearInterval(interval);
          console.error('[PROVIDER POLL] Reclaim failed:', data.error);
          setFailedProvider(activeVerifyProvider);
          setError(`Reclaim attestor failed for ${activeVerifyProvider}. You can retry or use demo data.`);
          setActiveVerifyProvider(null);
          setActiveVerifyQR(null);
        }
      } catch (err) { console.error(err); }
    }, 3000);
    return () => clearInterval(interval);
  }, [activeVerifyProvider, activeVerifyQR, address]);

  // Generate composite score from all verified providers
  const generateCompositeScore = async () => {
    setLoadingAction(true); setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/raas/composite-score/${address}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setScoreBreakdown(data);
      setGigScore(data.compositeScore);

      // Animate score
      const duration = 2000;
      const start = Date.now();
      const interval = setInterval(() => {
        const elapsed = Date.now() - start;
        if (elapsed >= duration) {
          setDisplayScore(data.compositeScore);
          clearInterval(interval);
          getSafeProfile().then(p => setFinalProfile(p));
          setTimeout(() => setPhase("complete"), 1000);
        } else {
          setDisplayScore(Math.floor(Math.random() * 900 + 100));
        }
      }, 50);
    } catch (err) {
      setError(err.message);
    }
    setLoadingAction(false);
  };

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
  const advanceToProviders = () => {
    setStep1Done(true);
    setPhase("income");
    setLoadingAction(false);
  };

  const handleSubmitAnonIdentity = async () => {
    if (!latestProof?.proof || !address || anonAadhaar?.status !== 'logged-in') {
      setError('Complete Anon Aadhaar login first.');
      return;
    }
    setLoadingAction(true); setError(null);

    try {
      // 1. Check if already verified on-chain — skip everything
      console.log('[IDENTITY] Checking on-chain state...');
      const profile = await getSafeProfile();
      console.log('[IDENTITY] On-chain profile:', profile);

      if (profile && profile.identityVerified) {
        console.log('[IDENTITY] Already verified on-chain — skipping');
        advanceToProviders();
        return;
      }

      // 2. Compute proof hash
      const proofHash = await hashAnonProof(latestProof.proof, address);
      console.log('[IDENTITY] Proof hash:', proofHash);

      // 3. Check if this proof hash was already used
      let isUsed = false;
      try {
        isUsed = await publicClient.readContract({
          address: CONTRACT_ADDRESS, abi: PramaanABI.abi, functionName: 'usedProofHashes', args: [proofHash]
        });
      } catch (_) { isUsed = false; }
      console.log('[IDENTITY] Proof hash already used?', isUsed);

      if (isUsed) {
        // Proof used — if this wallet is verified, just proceed
        const recheck = await getSafeProfile();
        if (recheck?.identityVerified) {
          console.log('[IDENTITY] Proof used + wallet verified — proceeding');
          advanceToProviders();
          return;
        }
        throw new Error("This Anon Aadhaar proof has already been used by another wallet.");
      }

      // 4. Estimate gas — if this fails, the tx WILL revert (don't even try sending)
      const ddocId = `anon-aadhaar:${address.toLowerCase()}:${Date.now()}`;
      console.log('[IDENTITY] Estimating gas for submitIdentity...', { ddocId, proofHash });
      let gas;
      try {
        const estimated = await publicClient.estimateContractGas({
          account: address, address: CONTRACT_ADDRESS, abi: PramaanABI.abi,
          functionName: 'submitIdentity', args: [ddocId, proofHash]
        });
        gas = (estimated * 120n) / 100n;
        console.log('[IDENTITY] Gas estimated:', gas.toString());
      } catch (gasErr) {
        console.error('[IDENTITY] Gas estimation FAILED — contract will revert:', gasErr?.shortMessage || gasErr?.message);
        // Last check: maybe identity got verified in the meantime
        const recheck = await getSafeProfile();
        if (recheck?.identityVerified) {
          console.log('[IDENTITY] Already verified despite gas error — proceeding');
          advanceToProviders();
          return;
        }
        throw new Error('Transaction would fail: ' + (gasErr?.shortMessage || gasErr?.message || 'contract revert'));
      }

      // 5. Send the transaction — this is where the wallet popup appears
      console.log('[IDENTITY] Calling writeContractAsync (wallet popup should appear)...');
      console.log('[IDENTITY] Params:', { chainId: baseSepolia.id, address: CONTRACT_ADDRESS, functionName: 'submitIdentity', ddocId, proofHash });
      let hash;
      try {
        // Don't pass explicit gas — let the wallet estimate natively
        // Some mobile wallets (WalletConnect) choke on BigInt gas values
        const txPromise = writeContractAsync({
          chainId: baseSepolia.id,
          address: CONTRACT_ADDRESS, abi: PramaanABI.abi,
          functionName: 'submitIdentity', args: [ddocId, proofHash]
        });
        const txTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('WALLET_TIMEOUT')), 30000)
        );
        hash = await Promise.race([txPromise, txTimeout]);
      } catch (txErr) {
        if (txErr.message === 'WALLET_TIMEOUT') {
          console.error('[IDENTITY] Wallet did not respond in 30s');
          throw new Error('Wallet not responding. Try disconnecting and reconnecting your wallet, then try again.');
        }
        console.error('[IDENTITY] writeContractAsync failed:', txErr);
        throw txErr;
      }
      console.log('[IDENTITY] Tx hash:', hash, '— waiting for confirmation...');

      // 6. Wait for receipt with timeout
      try {
        const receiptPromise = publicClient.waitForTransactionReceipt({ hash });
        const receiptTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('RECEIPT_TIMEOUT')), 60000)
        );
        await Promise.race([receiptPromise, receiptTimeout]);
        console.log('[IDENTITY] Tx confirmed!');
      } catch (waitErr) {
        console.warn('[IDENTITY] Receipt wait issue:', waitErr.message);
        // Check on-chain regardless
        const recheck = await getSafeProfile();
        if (recheck?.identityVerified) {
          console.log('[IDENTITY] Verified on-chain despite receipt issue');
          advanceToProviders();
          return;
        }
        // Tx might still be pending — advance anyway since tx was sent
        console.log('[IDENTITY] Tx sent but receipt pending — advancing');
      }

      advanceToProviders();
      return;
    } catch (err) {
      console.error('[IDENTITY] Final error:', err);
      const errMsg = err?.shortMessage || err?.message || '';

      // Any error — always do a final on-chain check before giving up
      try {
        const finalCheck = await getSafeProfile();
        if (finalCheck?.identityVerified) {
          console.log('[IDENTITY] On-chain check passed despite error — proceeding');
          advanceToProviders();
          return;
        }
      } catch (_) {}

      setError(errMsg || 'Identity submission failed');
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
          const hash = await writeContractAsync({ chainId: baseSepolia.id, 
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


  const handleGenerateReclaimIncomeQR = async () => {
    setLoadingAction(true); setError(null);
    try {
      const res = await fetch(`${BACKEND_URL}/api/reclaim/generate-request`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ walletAddress: address, provider: selectedProvider })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setReclaimIncomeQR(data.requestUrl);
    } catch (err) { setError(err.message); }
    setLoadingAction(false);
  };

  useEffect(() => {
    if (!reclaimIncomeQR || step2Done || !address) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/reclaim/status/reputation/${address}`);
        const data = await res.json();
        if (data.failed) {
          clearInterval(interval);
          setReclaimIncomeQR(null);
          setError(`Verification failed: ${data.error || 'Reclaim attestor error'}. Please try again.`);
          return;
        }
        if (data.ready) {
          clearInterval(interval);
          setReclaimIncomeQR(null);
          setLoadingAction(true);

          const platformName = data.platform || data.provider || 'GitHub';

          try {
            // Check on-chain first — if incomeVerified is already true, skip the tx
            const profile = await getSafeProfile();
            if (profile?.incomeVerified) {
              console.log('incomeVerified already true on-chain, skipping submitIncome');
              setStep2Done(true);
              setPhase("processing");
              generateGigScore(platformName);
              return;
            }

            const gas = await getSafeGasLimit('submitIncome', [data.ddocId, platformName, data.proofHash]);
            const hash = await writeContractAsync({
              chainId: baseSepolia.id,
              address: CONTRACT_ADDRESS,
              abi: PramaanABI.abi,
              functionName: 'submitIncome',
              args: [data.ddocId, platformName, data.proofHash],
              gas
            });
            await publicClient.waitForTransactionReceipt({ hash });

            setStep2Done(true);
            setPhase("processing");
            generateGigScore(platformName);
          } catch (txErr) {
            // If the proof was already used, treat it as already verified and proceed
            const errMsg = txErr?.shortMessage || txErr?.message || '';
            if (errMsg.includes('Proof already used') || errMsg.includes('already used')) {
              console.log('Proof already on-chain, proceeding to score generation');
              setStep2Done(true);
              setPhase("processing");
              generateGigScore(platformName);
            } else {
              console.error(txErr);
              setError(errMsg || "Transaction failed or rejected. Please try again.");
              setLoadingAction(false);
            }
          }
        }
      } catch (err) { console.error(err); }
    }, 3000);
    return () => clearInterval(interval);
  }, [reclaimIncomeQR, step2Done, address]);

  // --- SCORE & UI EFFECTS ---
  // --- STEP 3: REAL SCORING ---
  const generateGigScore = async (platform) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/agent/score/${address}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform: platform || 'GitHub' })
      });
      const data = await res.json();
      const finalScore = data.score !== undefined ? data.score : 0;
      
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
              <p className="text-muted-foreground mb-6 text-pretty">
                Securely verify your identity using Anon Aadhaar — a zero-knowledge proof that reveals only that you're 18+, nothing else.
              </p>

              {/* How to get your Aadhaar QR */}
              <div className="mb-6 p-4 rounded-xl border border-primary/20 bg-primary/5">
                <p className="text-sm font-semibold text-foreground mb-2">How to get your Secure QR Code</p>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex gap-2 items-start">
                    <span className="bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                    <span>Open the <strong className="text-foreground">mAadhaar app</strong> on your phone (available on <a href="https://play.google.com/store/apps/details?id=in.gov.uidai.mAadhaarPlus" target="_blank" rel="noreferrer" className="text-primary underline">Android</a> / <a href="https://apps.apple.com/in/app/maadhaar/id1435469474" target="_blank" rel="noreferrer" className="text-primary underline">iOS</a>)</span>
                  </div>
                  <div className="flex gap-2 items-start">
                    <span className="bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                    <span>Verify with your Aadhaar number + OTP, then tap <strong className="text-foreground">"Show QR Code"</strong></span>
                  </div>
                  <div className="flex gap-2 items-start">
                    <span className="bg-primary text-white rounded-full w-5 h-5 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                    <span>Screenshot or share the QR, then <strong className="text-foreground">upload the image</strong> below</span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground/60 mt-3 leading-relaxed">
                  Physical Aadhaar card QR codes use an older XML format without a digital signature — they won't work here.
                  You can also use the e-Aadhaar PDF downloaded from <a href="https://myaadhaar.uidai.gov.in" target="_blank" rel="noreferrer" className="text-primary underline">myaadhaar.uidai.gov.in</a>.
                </p>
              </div>

              <div className="glass-card p-6 flex flex-col gap-6">
                <div className="flex flex-col items-center gap-4 p-4 rounded-xl border border-border bg-white/50">
                  <LogInWithAnonAadhaar nullifierSeed={ANON_NULLIFIER_SEED} fieldsToReveal={['revealAgeAbove18']} signal={address || '0x0'} />
                  {anonAadhaar?.status === 'logged-in' && (
                    <button onClick={handleSubmitAnonIdentity} disabled={loadingAction} className="w-full mt-2 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 transition shadow-lg shadow-primary/20">
                      {loadingAction ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Submit Proof On-Chain"}
                    </button>
                  )}
                </div>
              </div>

              {/* Skip option — for demo or when wallet is unresponsive */}
              <button
                onClick={() => { setError(null); advanceToProviders(); }}
                className="mt-6 w-full text-center text-xs text-muted-foreground hover:text-foreground transition py-2"
              >
                Skip to Reputation Verification →
              </button>
            </motion.div>
          )}

          {/* PHASE 2: RaaS MULTI-PROVIDER VERIFICATION */}
          {phase === "income" && (
            <motion.div key="income" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.4 }}>
              <p className="text-sm text-primary font-medium uppercase tracking-wider mb-3">Step 2</p>
              <h1 className="text-2xl sm:text-3xl font-semibold text-foreground mb-2">Build Your Reputation</h1>
              <p className="text-muted-foreground mb-6 text-pretty">
                Verify your data sources via ZK proofs. More sources = higher composite score.
                <span className="text-primary font-medium"> Verify at least one to continue.</span>
              </p>

              {/* Provider Cards Grid */}
              {!activeVerifyQR && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                  {availableProviders.map((p) => {
                    const isVerified = !!verifiedProviders[p.key];
                    const IconComponent = p.icon === 'github' ? Github : p.icon === 'car' ? Car : p.icon === 'landmark' ? Landmark : p.icon === 'linkedin' ? Linkedin : p.icon === 'twitter' ? Twitter : p.icon === 'tv' ? Tv : p.icon === 'message-circle' ? MessageCircle : p.icon === 'shopping-cart' ? ShoppingCart : Code;
                    const categoryColor = p.category === 'developer' ? 'text-violet-500' : p.category === 'gig' ? 'text-amber-500' : p.category === 'financial' ? 'text-emerald-500' : p.category === 'entertainment' ? 'text-red-500' : p.category === 'ecommerce' ? 'text-orange-500' : 'text-blue-500';
                    const categoryBorder = isVerified ? 'border-success/40 bg-success/5' : 'border-border hover:border-primary/40 hover:bg-primary/5';

                    return (
                      <button
                        key={p.key}
                        onClick={() => !isVerified && startProviderVerification(p.key)}
                        disabled={isVerified || loadingAction}
                        className={`relative p-4 rounded-xl border ${categoryBorder} transition-all text-left group`}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${isVerified ? 'bg-success/10' : 'bg-muted/50 group-hover:bg-primary/10'} transition`}>
                            <IconComponent className={`w-5 h-5 ${isVerified ? 'text-success' : categoryColor}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-semibold text-sm text-foreground">{p.shortName}</p>
                              {isVerified && <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>
                            {isVerified && verifiedProviders[p.key]?.score > 0 && (
                              <p className="text-xs text-success font-medium mt-1">
                                Score: {verifiedProviders[p.key].score}/100 — Weight: {Math.round(p.weight * 100)}%
                              </p>
                            )}
                            {!isVerified && (
                              <p className="text-[10px] text-muted-foreground/70 mt-1 uppercase tracking-wide">
                                {p.category} — {Math.round(p.weight * 100)}% weight
                              </p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Active QR Code for provider being verified */}
              {activeVerifyQR && (
                <div className="glass-card p-6 mb-6">
                  <div className="text-center py-4">
                    <p className="text-xs text-muted-foreground mb-1">Verifying</p>
                    <p className="font-semibold text-foreground mb-4">
                      {availableProviders.find(p => p.key === activeVerifyProvider)?.name || activeVerifyProvider}
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">Scan with your phone to complete verification</p>
                    <div className="bg-white p-4 rounded-xl inline-block shadow-sm">
                      <QRCode value={activeVerifyQR} size={180} />
                    </div>
                    <p className="text-xs text-primary animate-pulse mt-4">Waiting for proof...</p>
                    <button
                      onClick={() => { setActiveVerifyProvider(null); setActiveVerifyQR(null); }}
                      className="mt-4 text-xs text-muted-foreground hover:text-foreground transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Demo fallback when Reclaim attestor fails */}
              {failedProvider && !verifiedProviders[failedProvider] && !activeVerifyQR && (
                <div className="mb-4 p-4 rounded-xl border border-amber-500/30 bg-amber-500/5">
                  <p className="text-sm text-foreground font-medium mb-1">Reclaim attestor is temporarily down</p>
                  <p className="text-xs text-muted-foreground mb-3">The ZK proof service failed for <span className="font-semibold">{failedProvider}</span>. You can retry or use demo data for now.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setFailedProvider(null); setError(null); startProviderVerification(failedProvider); }}
                      disabled={loadingAction}
                      className="flex-1 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition"
                    >
                      Retry
                    </button>
                    <button
                      onClick={() => useDemoData(failedProvider)}
                      disabled={loadingAction}
                      className="flex-1 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:brightness-95 transition"
                    >
                      Use Demo Data
                    </button>
                  </div>
                </div>
              )}

              {/* Verified count + Continue button */}
              {Object.keys(verifiedProviders).length > 0 && !activeVerifyQR && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <p className="text-sm text-muted-foreground">
                      <span className="text-foreground font-semibold">{Object.keys(verifiedProviders).length}</span> of {availableProviders.length} sources verified
                    </p>
                    {Object.keys(verifiedProviders).length < availableProviders.length && (
                      <p className="text-xs text-muted-foreground">Add more for a higher score</p>
                    )}
                  </div>
                  <button
                    onClick={() => {
                      setStep2Done(true);
                      setPhase("processing");
                      generateCompositeScore();
                    }}
                    className="w-full py-4 rounded-xl bg-primary text-white font-semibold hover:brightness-95 transition shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate Pramaan Score ({Object.keys(verifiedProviders).length} source{Object.keys(verifiedProviders).length > 1 ? 's' : ''})
                  </button>
                </div>
              )}

              {/* Fallback: Legacy single-provider flow (if providers API fails) */}
              {availableProviders.length === 0 && !activeVerifyQR && (
                <div className="glass-card p-6">
                  <div className="flex flex-col items-center gap-4">
                    {!reclaimIncomeQR ? (
                      <button onClick={handleGenerateReclaimIncomeQR} disabled={loadingAction} className="w-full py-4 rounded-xl bg-primary text-white font-medium hover:brightness-95 transition shadow-lg shadow-primary/20">
                        {loadingAction ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Verify GitHub Contributions"}
                      </button>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-xs text-muted-foreground mb-4">Scan with your phone to prove GitHub contributions</p>
                        <div className="bg-white p-4 rounded-xl inline-block shadow-sm">
                          <QRCode value={reclaimIncomeQR} size={180} />
                        </div>
                        <p className="text-xs text-primary animate-pulse mt-4">Waiting for proof of Github Contributions...</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
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
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1 font-semibold">Developer Score</p>
                  <p className="text-5xl font-black tabular-nums tracking-tighter text-primary">
                    {displayScore}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

         {/* --- PHASE 4: THE SUCCESS PASSPORT + SCORE BREAKDOWN --- */}
          {phase === "complete" && (
            <motion.div
              key="complete"
              className="w-full max-w-lg mx-auto"
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 120 }}
            >
              <div className="text-center mb-8">
                <div className="w-12 h-12 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-6 h-6 text-success" />
                </div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">Passport Verified</h1>
                {scoreBreakdown?.tier && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Tier: <span className="text-primary font-semibold">{scoreBreakdown.tier}</span>
                    {' '}&middot;{' '}
                    {scoreBreakdown.sourcesVerified} of {scoreBreakdown.totalPossibleSources} sources verified
                  </p>
                )}
              </div>

              {/* The Premium Passport Card */}
              <div className="glass-card p-8 mb-6 border-success/30 shadow-xl shadow-success/5 relative overflow-hidden text-left bg-gradient-to-br from-background to-success/5">
                 <div className="flex justify-between items-start mb-8">
                   <div className="bg-[#FFF9C4]/80 dark:bg-[#FFF9C4]/20 p-3 rounded-xl border border-yellow-200/50 backdrop-blur-sm shadow-sm inline-block">
                     <h2 className="text-base md:text-lg font-black uppercase tracking-[0.2em] text-success mb-1 drop-shadow-sm">Pramaan</h2>
                     <p className="text-[10px] md:text-xs text-muted-foreground font-bold uppercase tracking-widest">RaaS Passport</p>
                   </div>
                   <div className="text-right">
                     <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">Composite Score</p>
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
                    <p className="text-[10px] text-muted-foreground font-bold uppercase">Base Sepolia</p>
                   </div>
                 </div>
              </div>

              {/* Score Breakdown Card */}
              {scoreBreakdown?.breakdown && scoreBreakdown.breakdown.length > 0 && (
                <div className="glass-card p-6 mb-6 border-border">
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-4">Score Breakdown</p>
                  <div className="space-y-3">
                    {scoreBreakdown.breakdown.map((item) => {
                      const IconComp = item.icon === 'github' ? Github : item.icon === 'car' ? Car : item.icon === 'landmark' ? Landmark : item.icon === 'linkedin' ? Linkedin : item.icon === 'twitter' ? Twitter : item.icon === 'tv' ? Tv : item.icon === 'message-circle' ? MessageCircle : item.icon === 'shopping-cart' ? ShoppingCart : Code;
                      return (
                        <div key={item.provider} className="flex items-center gap-3">
                          <IconComp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1">
                            <div className="flex justify-between items-center">
                              <p className="text-sm font-medium text-foreground">{item.name}</p>
                              <p className="text-sm font-bold tabular-nums text-foreground">{item.score}</p>
                            </div>
                            <div className="w-full h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                              <motion.div
                                className="h-full bg-primary rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${item.score}%` }}
                                transition={{ delay: 0.5, duration: 0.8 }}
                              />
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {Math.round(item.weight * 100)}% weight &middot; +{item.weightedContribution} pts
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    {/* Bonuses */}
                    {scoreBreakdown.identityBonus > 0 && (
                      <div className="flex items-center gap-3 pt-2 border-t border-border/40">
                        <Fingerprint className="w-4 h-4 text-success flex-shrink-0" />
                        <div className="flex-1 flex justify-between">
                          <p className="text-sm text-muted-foreground">Identity Bonus</p>
                          <p className="text-sm font-bold text-success">+{scoreBreakdown.identityBonus}</p>
                        </div>
                      </div>
                    )}
                    {scoreBreakdown.diversityBonus > 0 && (
                      <div className="flex items-center gap-3">
                        <Plus className="w-4 h-4 text-primary flex-shrink-0" />
                        <div className="flex-1 flex justify-between">
                          <p className="text-sm text-muted-foreground">Multi-Source Bonus</p>
                          <p className="text-sm font-bold text-primary">+{scoreBreakdown.diversityBonus}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}