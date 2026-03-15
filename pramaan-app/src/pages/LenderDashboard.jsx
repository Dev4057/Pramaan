import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useWriteContract, usePublicClient, useReadContract } from 'wagmi';
import axios from 'axios';
import { Bot, Loader2, ShieldAlert, CheckCircle2, Search, ArrowRight } from "lucide-react";
import PramaanABI from '../abi/Pramaan.json';

// --- CONSTANTS ---
const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
const ERC20_ABI = [{ type: 'function', name: 'transfer', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] }];
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';

export default function LenderDashboard() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  // Fetch the mock USDC address deployed with Pramaan on Sepolia securely.
  const { data: usdcAddress } = useReadContract({ 
    address: CONTRACT_ADDRESS, abi: PramaanABI.abi, functionName: 'usdc' 
  });

  const [workerAddress, setWorkerAddress] = useState("0x1588c7C9A274BaC1f965D52838093FE871D79AE6"); // Default demo wallet
  const [loading, setLoading] = useState(false);
  const [workerData, setWorkerData] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState(""); // For UI feedback
  const [error, setError] = useState(null);

  const handleUnlockScore = async () => {
    console.log("--- Starting x402 Credit Unlock Flow ---");
    console.log("Target Worker:", workerAddress);
    console.log("Current Lender Address:", address);
    
    if (!workerAddress) return;
    setLoading(true);
    setError(null);
    setPaymentStatus("Fetching data...");

    try {
      console.log("1. Attempting to fetch worker score without payment proof...");
      // 1. Initial attempt (Will fail with 402 if unpaid)
      const response = await axios.get(`${BACKEND_URL}/api/lender/worker-score/${workerAddress}`);
      
      console.log("Success on first try (Free access or already paid?):", response.data);
      setWorkerData(response.data);
      setPaymentStatus("");

    } catch (err) {
      console.warn("Fetch failed, inspecting error format:", err.message);
      
      // 2. Catch the x402 Payment Required
      if (err.response && err.response.status === 402) {
        console.log("x402 Protocol Triggered: HTTP 402 Payment Required intercepted!");
        console.log("Headers attached to 402 response:", err.response.headers);
        
        setPaymentStatus("x402 Protocol: 0.05 USDC Fee Required. Please sign in your wallet...");
        
        try {
          const paymentAddress = err.response.headers['x-payment-address'] || '0xa60d26d641fC807C9659df3f1A5E24Dc54C6baD7';
          const paymentAmountRaw = err.response.headers['x-payment-amount'] || '50000';
          const paymentAmount = BigInt(paymentAmountRaw);
          
          console.log(`Preparing to send ${paymentAmountRaw} units of USDC to ${paymentAddress} on Base L2...`);

          // 3. Lender signs the USDC transfer on the connected network
          console.log(`USDC Address dynamically loaded: ${usdcAddress}`);
          
          if (!usdcAddress) {
            throw new Error("Mock USDC Address not loaded yet. Please wait a second and try again.");
          }

          setPaymentStatus("Awaiting MetaMask confirmation...");
          
          const txHash = await writeContractAsync({
            address: usdcAddress, 
            abi: ERC20_ABI,
            functionName: 'transfer',
            args: [paymentAddress, paymentAmount]
          });

          console.log(`MetaMask approved! USDC Transfer TxHash: ${txHash}`);
          setPaymentStatus(`Payment sent (Tx: ${txHash.slice(0,8)}...). Unlocking Pramaan Agent Analysis...`);
          
          // FOR DEMO: We skip waiting for Sepolia block confirmation to prevent infinite UI buffering
          // try {
          //  await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });
          // } catch(e) { console.log(e) }

          // 4. Retry the fetch with the transaction hash as the proof
          console.log("Retrying Axios fetch with 'x-payment-proof' header injected...");
          
          const retryResponse = await axios.get(`${BACKEND_URL}/api/lender/worker-score/${workerAddress}`, {
            headers: { 'x-payment-proof': txHash }
          });

          console.log("x402 Retry Successful! Private data unlocked:", retryResponse.data);
          setWorkerData(retryResponse.data);
          setPaymentStatus("");

        } catch (txError) {
          console.error("Payment failed on Metamask/Viem step:", txError);
          setError("Payment rejected or failed. Cannot unlock report.");
          setPaymentStatus("");
        }
      } else {
        console.error("Standard API Error (Not a 402):", err);
        setError("Failed to fetch worker data. Is the backend running?");
        setPaymentStatus("");
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-svh bg-background p-8 pt-24">
      <div className="max-w-3xl mx-auto">
        
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2 flex items-center gap-3">
            <ShieldAlert className="text-primary w-8 h-8" />
            Lender Bureau
          </h1>
          <p className="text-muted-foreground">Access verified ZK-income data and AI credit risk analysis via the x402 protocol.</p>
        </div>

        {/* Search / Input Box */}
        <div className="glass-card p-6 mb-8 border-border">
          <label className="block text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Target Worker Wallet</label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/50" />
              <input 
                type="text" 
                value={workerAddress}
                onChange={(e) => setWorkerAddress(e.target.value)}
                className="w-full bg-white/5 border border-border rounded-xl py-3 pl-10 pr-4 text-foreground focus:outline-none focus:border-primary transition-colors font-mono text-sm"
                placeholder="0x..."
              />
            </div>
            <button 
              onClick={handleUnlockScore} 
              disabled={loading || !workerAddress}
              className="px-6 py-3 bg-primary text-white font-bold rounded-xl flex items-center gap-2 hover:brightness-110 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Bot className="w-5 h-5" />}
              Unlock Report
            </button>
          </div>
          
          {/* Real-time Status Updates for the Demo */}
          <AnimatePresence>
            {paymentStatus && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-4 text-sm font-mono text-primary flex items-center gap-2 bg-primary/10 p-3 rounded-lg border border-primary/20">
                <Loader2 className="w-4 h-4 animate-spin" /> {paymentStatus}
              </motion.div>
            )}
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-4 text-sm font-mono text-destructive flex items-center gap-2 bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                {error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* The Unlocked Credit Report */}
        <AnimatePresence>
          {workerData && !loading && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              className="glass-card p-8 border-success/30 shadow-2xl shadow-success/5 bg-gradient-to-br from-background to-success/5"
            >
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="text-xl font-bold uppercase tracking-widest text-success mb-1">Deep Credit Analysis</h2>
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-success"/> x402 Payment Verified
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">Gig Score</p>
                  <p className="text-5xl font-black tracking-tighter tabular-nums text-foreground">{workerData.score}</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 pb-6 border-b border-border/40">
                  <div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Worker Wallet</p>
                    <p className="text-sm font-mono-data text-foreground/80">{workerAddress.slice(0,8)}...{workerAddress.slice(-6)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Primary Income Source</p>
                    <p className="text-sm font-bold text-foreground/80">{workerData.platform}</p>
                  </div>
                </div>

                <div className="bg-black/20 p-5 rounded-xl border border-white/5">
                  <p className="text-xs font-bold text-primary uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Bot className="w-4 h-4"/> Pramaan Agent Insights
                  </p>
                  <p className="text-sm leading-relaxed italic text-muted-foreground">
                    "{workerData.details}"
                  </p>
                </div>
                
                <button className="w-full py-4 mt-4 rounded-xl bg-success text-success-foreground font-bold text-sm shadow-lg hover:brightness-110 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                  Approve & Disburse Loan <ArrowRight className="w-4 h-4" />
                </button>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}