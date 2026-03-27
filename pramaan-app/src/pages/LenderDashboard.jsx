import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useWriteContract, usePublicClient, useReadContract } from 'wagmi';
import axios from 'axios';
import { Bot, Loader2, ShieldAlert, CheckCircle2, Search, ArrowRight, Shield, ShieldCheck, ShieldX, BarChart3, Users, TrendingUp, AlertTriangle, Github, Car, Landmark, Linkedin, Twitter, Tv, MessageCircle, ShoppingCart, Code } from "lucide-react";
import PramaanABI from '../abi/Pramaan.json';

const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS;
const ERC20_ABI = [{ type: 'function', name: 'transfer', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] }];
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
const LENDER_API_KEY = import.meta.env.VITE_LENDER_API_KEY || 'pk_pramaan_demo_2026';

const ICON_MAP = {
  github: Github, car: Car, landmark: Landmark, linkedin: Linkedin,
  twitter: Twitter, tv: Tv, 'message-circle': MessageCircle, 'shopping-cart': ShoppingCart
};
const CATEGORY_COLORS = {
  developer: 'text-violet-400', gig: 'text-amber-400', financial: 'text-emerald-400',
  social: 'text-blue-400', entertainment: 'text-red-400', ecommerce: 'text-orange-400'
};
const TIER_STYLES = {
  'Exceptional': { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', badge: 'Lowest Risk' },
  'Strong': { color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30', badge: 'Low Risk' },
  'Moderate': { color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', badge: 'Moderate Risk' },
  'Developing': { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', badge: 'Elevated Risk' },
  'Early-Stage': { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', badge: 'High Risk' },
};

export default function LenderDashboard() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { data: usdcAddress } = useReadContract({
    address: CONTRACT_ADDRESS, abi: PramaanABI.abi, functionName: 'usdc'
  });

  const [workerAddress, setWorkerAddress] = useState("0x1588c7C9A274BaC1f965D52838093FE871D79AE6");
  const [loading, setLoading] = useState(false);
  const [workerData, setWorkerData] = useState(null);
  const [paymentStatus, setPaymentStatus] = useState("");
  const [error, setError] = useState(null);

  const handleUnlockScore = async () => {
    if (!workerAddress) return;
    setLoading(true);
    setError(null);
    setWorkerData(null);
    setPaymentStatus("Querying Pramaan Bureau...");

    try {
      const response = await axios.get(`${BACKEND_URL}/api/lender/worker-score/${workerAddress}`, {
        headers: { 'x-api-key': LENDER_API_KEY }
      });

      const onChainScore = await publicClient.readContract({
        address: CONTRACT_ADDRESS, abi: PramaanABI.abi,
        functionName: 'getGigScore', args: [workerAddress]
      });

      setWorkerData({ ...response.data, score: Number(onChainScore) });
      setPaymentStatus("");
    } catch (err) {
      if (err.response && err.response.status === 402) {
        setPaymentStatus("x402 Protocol: 0.05 USDC fee required. Awaiting wallet signature...");

        try {
          const paymentAddress = err.response.headers['x-payment-address'];
          const paymentAmount = BigInt(err.response.headers['x-payment-amount']);
          if (!usdcAddress) throw new Error("USDC contract not loaded. Please wait and retry.");
          if (!paymentAddress) throw new Error("Payment address not received.");

          setPaymentStatus("Confirm USDC transfer in your wallet...");
          const txHash = await writeContractAsync({
            address: usdcAddress, abi: ERC20_ABI,
            functionName: 'transfer', args: [paymentAddress, paymentAmount]
          });

          setPaymentStatus(`Payment confirmed (${txHash.slice(0, 10)}...). Generating AI analysis...`);

          const retryResponse = await axios.get(`${BACKEND_URL}/api/lender/worker-score/${workerAddress}`, {
            headers: { 'x-api-key': LENDER_API_KEY, 'x-payment-proof': txHash }
          });

          const onChainScore = await publicClient.readContract({
            address: CONTRACT_ADDRESS, abi: PramaanABI.abi,
            functionName: 'getGigScore', args: [workerAddress]
          });

          setWorkerData({ ...retryResponse.data, score: Number(onChainScore) });
          setPaymentStatus("");
        } catch (txError) {
          setError("Payment rejected or failed. Cannot unlock report.");
          setPaymentStatus("");
        }
      } else {
        setError(err.response?.data?.error || "Failed to fetch worker data. Is the backend running?");
        setPaymentStatus("");
      }
    }
    setLoading(false);
  };

  const tierStyle = workerData ? (TIER_STYLES[workerData.tier] || TIER_STYLES['Early-Stage']) : null;

  return (
    <div className="min-h-svh bg-background p-6 pt-24">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2 flex items-center gap-3">
            <ShieldAlert className="text-primary w-8 h-8" />
            Lender Bureau
          </h1>
          <p className="text-muted-foreground">Access verified ZK-reputation data and AI credit risk analysis via the x402 micropayment protocol.</p>
        </div>

        {/* Search */}
        <div className="glass-card p-6 mb-8 border-border">
          <label className="block text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Target Worker Wallet</label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/50" />
              <input
                type="text" value={workerAddress}
                onChange={(e) => setWorkerAddress(e.target.value)}
                className="w-full bg-white/5 border border-border rounded-xl py-3 pl-10 pr-4 text-foreground focus:outline-none focus:border-primary transition-colors font-mono text-sm"
                placeholder="0x..."
              />
            </div>
            <button
              onClick={handleUnlockScore} disabled={loading || !workerAddress}
              className="px-6 py-3 bg-primary text-white font-bold rounded-xl flex items-center gap-2 hover:brightness-110 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Bot className="w-5 h-5" />}
              Verify & Access Report
            </button>
          </div>

          <AnimatePresence>
            {paymentStatus && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="mt-4 text-sm font-mono text-primary flex items-center gap-2 bg-primary/10 p-3 rounded-lg border border-primary/20">
                <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" /> {paymentStatus}
              </motion.div>
            )}
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                className="mt-4 text-sm font-mono text-destructive flex items-center gap-2 bg-destructive/10 p-3 rounded-lg border border-destructive/20">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Full Credit Report */}
        <AnimatePresence>
          {workerData && !loading && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
              className="space-y-6"
            >
              {/* Score Header Card */}
              <div className={`glass-card p-8 ${tierStyle.border} border shadow-2xl`}>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-success" /> x402 Payment Verified — Full Report Unlocked
                    </p>
                    <h2 className="text-2xl font-bold tracking-tight text-foreground">Pramaan Credit Report</h2>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Composite Score</p>
                    <p className="text-6xl font-black tracking-tighter tabular-nums text-foreground leading-none">{workerData.score}</p>
                    <span className={`inline-block mt-2 text-xs font-bold px-3 py-1 rounded-full ${tierStyle.bg} ${tierStyle.color} ${tierStyle.border} border`}>
                      {workerData.tier || 'Unknown'} — {tierStyle.badge}
                    </span>
                  </div>
                </div>

                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t border-border/30">
                  <div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Worker Wallet</p>
                    <p className="text-sm font-mono text-foreground/80">{workerAddress.slice(0, 8)}...{workerAddress.slice(-6)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Identity (Aadhaar ZK)</p>
                    <p className={`text-sm font-bold flex items-center gap-1.5 ${workerData.identityVerified ? 'text-success' : 'text-destructive'}`}>
                      {workerData.identityVerified ? <ShieldCheck className="w-4 h-4" /> : <ShieldX className="w-4 h-4" />}
                      {workerData.identityVerified ? 'Verified' : 'Not Verified'}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Sources Verified</p>
                    <p className="text-sm font-bold text-foreground/80 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-primary" />
                      {workerData.sourcesVerified || workerData.breakdown?.length || 1} / {workerData.totalSources || 8}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">On-Chain Tx</p>
                    {workerData.scoreTxHash ? (
                      <a href={`https://sepolia.basescan.org/tx/${workerData.scoreTxHash}`} target="_blank" rel="noreferrer"
                        className="text-sm font-mono text-primary hover:underline">{workerData.scoreTxHash.slice(0, 12)}...</a>
                    ) : <p className="text-sm text-muted-foreground">—</p>}
                  </div>
                </div>
              </div>

              {/* Provider Breakdown */}
              {workerData.breakdown && workerData.breakdown.length > 0 && (
                <div className="glass-card p-6 border-border">
                  <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-5 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary" /> Provider-Level Verification Breakdown
                  </h3>
                  <div className="space-y-3">
                    {workerData.breakdown.map((p) => {
                      const IconComp = ICON_MAP[p.icon] || Code;
                      const catColor = CATEGORY_COLORS[p.category] || 'text-blue-400';
                      const barWidth = Math.max(p.score, 3);

                      let metricDisplay = '';
                      const m = p.rawMetric;
                      if (typeof m === 'object' && m !== null) {
                        if (m.rating !== undefined) metricDisplay = `${m.rating}★, ${(m.trips || 0).toLocaleString()} trips`;
                        else if (m.balance !== undefined) metricDisplay = `₹${(m.balance || 0).toLocaleString()} bal, ₹${(m.monthlyIncome || 0).toLocaleString()}/mo`;
                        else if (m.type === 'followers') metricDisplay = `${m.value.toLocaleString()} followers`;
                        else if (m.type === 'watch_count') metricDisplay = `${m.value} titles`;
                        else if (m.type === 'servers') metricDisplay = `${m.value} servers`;
                        else if (m.type === 'order_count') metricDisplay = `${m.value} orders`;
                        else if (m.type === 'connections') metricDisplay = `${m.value} connections`;
                        else if (m.type === 'profile_verified') metricDisplay = 'Profile verified';
                        else metricDisplay = JSON.stringify(m);
                      } else {
                        metricDisplay = `${m} ${p.metricLabel || ''}`.trim();
                      }

                      return (
                        <div key={p.provider} className="bg-white/[0.03] rounded-xl p-4 border border-border/30">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center ${catColor}`}>
                                <IconComp className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-foreground">{p.name}</p>
                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{p.category} — {Math.round((p.weight || 0) * 100)}% weight</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-black tabular-nums text-foreground">{p.score}</p>
                              <p className="text-[10px] text-muted-foreground">{metricDisplay}</p>
                            </div>
                          </div>
                          <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }} animate={{ width: `${barWidth}%` }}
                              transition={{ duration: 0.8, ease: 'easeOut' }}
                              className={`h-full rounded-full ${p.score >= 75 ? 'bg-emerald-500' : p.score >= 50 ? 'bg-yellow-500' : p.score >= 25 ? 'bg-orange-500' : 'bg-red-500'}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* AI Credit Risk Analysis */}
              <div className="glass-card p-6 border-primary/20 bg-gradient-to-br from-background to-primary/5">
                <h3 className="text-sm font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                  <Bot className="w-5 h-5" /> AI Credit Risk Analysis
                </h3>
                <div className="bg-black/20 rounded-xl p-5 border border-white/5">
                  {workerData.ai_analysis ? (
                    <div className="space-y-4">
                      {workerData.ai_analysis.split('\n\n').map((para, i) => (
                        <p key={i} className="text-sm leading-relaxed text-muted-foreground">
                          {para}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Score verified on-chain via Pramaan Protocol. No detailed AI analysis available.
                    </p>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground/50 mt-3 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> Analysis generated locally — no personal data sent to external servers.
                </p>
              </div>

              {/* Action Button */}
              <button className="w-full py-4 rounded-xl bg-success text-success-foreground font-bold text-sm shadow-lg hover:brightness-110 transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                <TrendingUp className="w-4 h-4" /> Approve & Disburse Loan <ArrowRight className="w-4 h-4" />
              </button>

            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
