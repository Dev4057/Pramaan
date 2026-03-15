import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, CheckCircle2, Fingerprint, BarChart3, Loader2, ArrowRight, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useReadContract, useWriteContract, usePublicClient, useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import PramaanABI from '../abi/Pramaan.json'; 

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;

// The standard ERC20 ABI just for the approve function
const ERC20_ABI = [
  { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] }
];

// The safe ABI to handle the extra ZK bytes32 fields
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

export default function VerifyIdentity() {
  const navigate = useNavigate();
  const publicClient = usePublicClient();
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const [workerAddress, setWorkerAddress] = useState('');
  const [lookupAddress, setLookupAddress] = useState(null);
  
  async function openFileverseDdoc(id) {
    if (!id) return;
    try {
      const res = await fetch(`http://localhost:8001/api/ddocs/${id}?apiKey=8gqxM-bxHZ0cbIZSlK8cnFxMoq1yMiJL`);
      if (!res.ok) {
        alert("DDoc not found or not synced yet!");
        return;
      }
      const data = await res.json();
      if (data.link) {
        window.open(data.link + '?dev-mode=true', '_blank');
      } else {
        alert("Document is still syncing to Fileverse. Please try again in a few seconds.");
      }
    } catch (err) {
      console.error("Error opening dDoc:", err);
      alert("Error fetching from local Fileverse node.");
    }
  }

  // State management for the complex dual-transaction flow
  const [paying, setPaying] = useState(false);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState(null);

  // --- WEB3 READS ---
  const { data: usdcAddress } = useReadContract({ 
    address: CONTRACT_ADDRESS, abi: PramaanABI.abi, functionName: 'usdc' 
  });
  
  const { data: verificationFee } = useReadContract({ 
    address: CONTRACT_ADDRESS, abi: PramaanABI.abi, functionName: 'verificationFee' 
  });

  // These only fetch data IF the user has successfully paid (paid === true)
  const { data: profile, isLoading: isProfileLoading } = useReadContract({ 
    address: CONTRACT_ADDRESS, abi: WORKER_GETTER_ABI, functionName: 'workers', args: [lookupAddress], query: { enabled: !!lookupAddress && paid } 
  });
  
  const { data: score, isLoading: isScoreLoading } = useReadContract({ 
    address: CONTRACT_ADDRESS, abi: PramaanABI.abi, functionName: 'getGigScore', args: [lookupAddress], query: { enabled: !!lookupAddress && paid } 
  });

  // --- THE PAYMENT FLOW ---
  const handleVerify = async () => {
    console.log("--- Starting Verification Flow ---");
    console.log("Worker Address:", workerAddress);
    console.log("Current User Address:", address);
    
    if (!address) {
      setError('Please connect your wallet first.');
      return;
    }
    if (!workerAddress || !publicClient || !usdcAddress || !verificationFee) {
      console.log("Missing prerequisites:", { workerAddress: !!workerAddress, publicClient: !!publicClient, usdcAddress, verificationFee });
      return;
    }
    
    // Basic formatting check
    if (!/^0x[a-fA-F0-9]{40}$/.test(workerAddress)) {
      setError('Please enter a valid 42-character Ethereum wallet address.');
      return;
    }

    setPaying(true); 
    setError(null);

    try {
      // Pre-flight check via readonly call
      console.log("Running pre-flight worker profile check (Extended ABI)...");
      try {
        const profilePreflight = await publicClient.readContract({
          address: CONTRACT_ADDRESS,
          abi: WORKER_GETTER_ABI,
          functionName: 'workers',
          args: [workerAddress]
        });
        
        console.log("Extended ABI Profile Result:", profilePreflight);
        
        // Extended ABI array mapping: [0: identityVerified, 1: incomeVerified, 2: gigScore, ...]
        if (!profilePreflight[13]) {
            console.log("Pre-flight failed: Worker doesn't exist");
            throw new Error('Worker not found');
        }
        if (!profilePreflight[0] || !profilePreflight[1]) {
            console.log("Pre-flight failed: Identity/Income incomplete");
            throw new Error('Profile incomplete');
        }
        if (profilePreflight[2] === 0) {
            console.log("Pre-flight failed: Score is 0");
            throw new Error('Score not set');
        }
        console.log("Pre-flight check passed (Extended ABI)");
      } catch (err) {
        console.warn("Extended ABI pre-flight check failed or returned error:", err);
        // Fallback to legacy ABI pre-flight check if ZK fields aren't supported on current chain iteration
        try {
          console.log("Running pre-flight fallback check (Legacy ABI)...");
          const profilePreflightLegacy = await publicClient.readContract({
            address: CONTRACT_ADDRESS,
            abi: PramaanABI.abi,
            functionName: 'workers',
            args: [workerAddress]
          });

          console.log("Legacy ABI Profile Result:", profilePreflightLegacy);

          // Length 10 array
          const exists = profilePreflightLegacy[profilePreflightLegacy.length - 1]; 
          const identityVerified = profilePreflightLegacy[0];
          const incomeVerified = profilePreflightLegacy[1];
          const gigScore = profilePreflightLegacy[2];

          if (!exists) {
              console.log("Pre-flight legacy failed: Worker doesn't exist");
              throw new Error('Worker not found');
          }
          if (!identityVerified || !incomeVerified) {
              console.log("Pre-flight legacy failed: Identity/Income incomplete");
              throw new Error('Profile incomplete');
          }
          if (gigScore === 0) {
              console.log("Pre-flight legacy failed: Score is 0");
              throw new Error('Score not set');
          }
          console.log("Pre-flight check passed (Legacy ABI)");
        } catch(fallbackErr) {
            console.warn("Legacy ABI pre-flight also threw an error:", fallbackErr);
            if (fallbackErr.message.includes('Worker not found') || 
                fallbackErr.message.includes('Profile incomplete') || 
                fallbackErr.message.includes('Score not set')) {
                throw fallbackErr;
            } else {
                throw err; // throw orig ZK formatting error if we didn't explicitly find standard contract failure rules
            }
        }
      }

      console.log("Starting USDC Approval Step...");
      // Step 1: Approve the Pramaan Contract to spend the USDC fee
      let approveHash;
      try {
        approveHash = await writeContractAsync({ 
          address: usdcAddress, 
          abi: ERC20_ABI, 
          functionName: 'approve', 
          args: [CONTRACT_ADDRESS, verificationFee] 
        });
        console.log("USDC Approval Transaction Hash:", approveHash);
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
        console.log("USDC Approval Mined Successfully.");
      } catch (e) {
        console.error("USDC Approve failed:", e);
        throw new Error('Approval transaction failed or was rejected.');
      }

      console.log("Starting Worker Verification Step...");
      // Step 2: Execute the verifyWorker function on Pramaan
      let gas;
      try {
        console.log("Estimating gas for verifyWorker...");
        const estimated = await publicClient.estimateContractGas({
          account: address,
          address: CONTRACT_ADDRESS, 
          abi: PramaanABI.abi, 
          functionName: 'verifyWorker', 
          args: [workerAddress]
        });
        gas = (estimated * 120n) / 100n;
        console.log("Gas Estimated:", estimated.toString(), "With Buffer:", gas.toString());
      } catch (err) {
        console.error("Gas estimation for verifyWorker failed:", err);
        gas = 500000n; // Safe fallback
        console.log("Using safe fallback gas limit:", gas.toString());
      }

      console.log("Sending verifyWorker transaction...");
      const verifyHash = await writeContractAsync({ 
        address: CONTRACT_ADDRESS, 
        abi: PramaanABI.abi, 
        functionName: 'verifyWorker', 
        args: [workerAddress],
        gas
      });
      console.log("Worker Verification Tx Hash:", verifyHash);
      await publicClient.waitForTransactionReceipt({ hash: verifyHash });
      console.log("Worker Verification Tx Mined Successfully!");

      // Success! Move the UI to the results phase
      setLookupAddress(workerAddress);
      setPaid(true);
    } catch (err) {
      console.error("--- Top Level Error Catcher in handleVerify ---", err);
      
      // Attempt to map common revert errors to human readable text
      const errText = String(err?.shortMessage || err?.message || '');
      if (errText.includes('Worker not found')) setError('Verification Failed: This worker has not registered an identity yet.');
      else if (errText.includes('Profile incomplete')) setError('Verification Failed: The worker has not completed all verification steps.');
      else if (errText.includes('Score not set')) setError('Verification Failed: The AI agent has not computed a score for this worker yet.');
      else if (errText.includes('Score expired')) setError('Verification Failed: The worker score has expired.');
      else if (errText.includes('transfer amount exceeds balance')) setError('Verification Failed: Insufficient USDC balance.');
      else if (errText.includes('insufficient allowance')) setError('Verification Failed: Internal allowance failed. Try again.');
      else if (errText.includes('rejected')) setError('Transaction was rejected by the user.');
      else setError('Verification transaction failed. Ensure you have USDC and Sepolia ETH.');
      
      setPaid(false);
    }
    setPaying(false);
  };

  const handleReset = () => {
    setPaid(false);
    setWorkerAddress('');
    setLookupAddress(null);
    setError(null);
  };

  return (
    <div className="min-h-svh bg-background flex flex-col items-center justify-center px-6 py-24">
      <div className="max-w-2xl w-full">
        <motion.button
          onClick={() => navigate("/gateway")}
          className="mb-8 text-sm text-muted-foreground hover:text-foreground transition-colors"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        >
          ← Back to Gateway
        </motion.button>

        <motion.div className="mb-10" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-sm text-primary font-medium uppercase tracking-wider mb-3">Lender Portal</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-foreground">Verify an Identity</h1>
          <p className="text-muted-foreground mt-2">Pay a small USDC fee to instantly cryptographically verify a worker's GigScore.</p>
        </motion.div>

        <AnimatePresence mode="wait">
          {!paid ? (
            // --- INPUT PHASE ---
            <motion.div key="input" className="glass-card p-8" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
              
              {error && (
                <div className="mb-6 p-4 rounded-xl bg-destructive/10 text-destructive text-sm border border-destructive/20 text-center">
                  {error}
                </div>
              )}
              
              <label className="text-sm font-medium text-foreground mb-3 block">Target Worker Address</label>
              <input
                type="text"
                value={workerAddress}
                onChange={(e) => setWorkerAddress(e.target.value.trim())}
                placeholder="0x..."
                className="w-full px-5 py-4 rounded-2xl bg-white border border-border text-foreground font-mono-data text-base placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all mb-6"
              />

              <div className="bg-primary/5 rounded-xl p-5 mb-8 border border-primary/10">
                <div className="flex justify-between text-sm mb-3">
                  <span className="text-muted-foreground font-medium">Verification Fee</span>
                  <span className="font-semibold text-primary">{verificationFee ? `${formatUnits(verificationFee, 6)} USDC` : 'Loading...'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground font-medium">Network</span>
                  <span className="font-medium text-foreground">Ethereum Sepolia</span>
                </div>
              </div>

              <button
                onClick={handleVerify}
                disabled={paying || !workerAddress || !verificationFee}
                className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-primary text-primary-foreground font-medium transition-all duration-200 ease-out hover:brightness-95 hover:shadow-lg active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none"
              >
                {paying ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Processing Transactions...</>
                ) : (
                  <><Shield className="w-5 h-5" /> Verify & Pay USDC</>
                )}
              </button>
              {paying && <p className="text-center text-xs text-muted-foreground mt-4 animate-pulse">This requires two MetaMask signatures (Approve, then Verify)</p>}
            </motion.div>
          ) : (
            // --- RESULT PHASE (THE PASSPORT) ---
            <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <div className="glass-card p-8 mb-6 border-success/30 shadow-lg shadow-success/10" style={{ aspectRatio: "1.58 / 1" }}>
                <div className="h-full flex flex-col justify-between">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Pramaan Protocol</p>
                      <div className="flex items-center gap-3 mt-3">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Shield className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm font-mono-data">{lookupAddress?.slice(0, 8)}...{lookupAddress?.slice(-6)}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">Platform: {profile?.[6] || 'N/A'}</p> 
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground mb-1">Gig Score</p>
                      <p className="text-5xl font-semibold font-mono-data tracking-tight text-foreground">
                        {isScoreLoading ? '...' : score?.toString() || '0'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-end justify-between">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 text-success text-xs font-medium border border-success/20">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      On-Chain Verified
                    </div>
                    <div className="text-xs text-muted-foreground font-mono-data">
                      Doc ID: {profile?.[4]?.slice(0, 15) || 'N/A'}...
                    </div>
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="glass-card p-5">
                  <Fingerprint className="w-4 h-4 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">Identity Status</p>
                  <p className={`text-sm font-medium mt-0.5 ${profile?.[0] ? 'text-success' : 'text-destructive'}`}>
                    {isProfileLoading ? 'Loading...' : (profile?.[0] ? 'Verified' : 'Failed')}
                  </p>
                </div>
                <div className="glass-card p-5">
                  <BarChart3 className="w-4 h-4 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">Income Status</p>
                  <p className={`text-sm font-medium mt-0.5 ${profile?.[1] ? 'text-success' : 'text-destructive'}`}>
                    {isProfileLoading ? 'Loading...' : (profile?.[1] ? 'Confirmed' : 'Failed')}
                  </p>
                </div>
              </div>

              {/* --- NEW FILEVERSE PROOF BUTTONS --- */}
              <div className="grid grid-cols-2 gap-3 mt-4 mb-2">
                <button 
                  onClick={() => openFileverseDdoc(profile?.[4])}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/50 transition-all shadow-sm"
                  title="View encrypted ZK proof on Fileverse"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Identity dDoc
                </button>
                <button 
                  onClick={() => openFileverseDdoc(profile?.[5])}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-white/50 transition-all shadow-sm"
                  title="View encrypted Reclaim proof on Fileverse"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Income dDoc
                </button>
              </div>

              <button 
                onClick={handleReset} 
                className="mt-8 w-full py-4 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors glass-card-hover"
              >
                Verify Another Identity
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}