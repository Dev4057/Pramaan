import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Copy, Check, ChevronDown, ChevronRight,
  Globe, Shield, CreditCard, Users, BarChart3, Zap, Lock, Server
} from "lucide-react";

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:4000";

// ─── Code Block Component ───────────────────────────────────────
const CodeBlock = ({ code, language = "json" }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group rounded-xl overflow-hidden bg-[#1a1a2e] border border-white/5">
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/30">{language}</span>
        <button onClick={handleCopy} className="text-white/30 hover:text-white/70 transition-colors">
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
      <pre className="p-4 text-sm leading-relaxed overflow-x-auto">
        <code className="text-emerald-300/90 font-mono text-xs">{code}</code>
      </pre>
    </div>
  );
};

// ─── Method Badge ───────────────────────────────────────────────
const MethodBadge = ({ method }) => {
  const colors = {
    GET: "bg-emerald-500/15 text-emerald-600 border-emerald-500/20",
    POST: "bg-blue-500/15 text-blue-600 border-blue-500/20",
    PUT: "bg-amber-500/15 text-amber-600 border-amber-500/20",
    DELETE: "bg-red-500/15 text-red-600 border-red-500/20",
  };
  return (
    <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-md border ${colors[method] || colors.GET}`}>
      {method}
    </span>
  );
};

// ─── Expandable Endpoint ────────────────────────────────────────
const Endpoint = ({ method, path, title, description, headers, pathParams, bodyParams, response, note }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-foreground/[0.02] transition-colors"
      >
        <MethodBadge method={method} />
        <code className="text-sm font-mono-data text-foreground/80 flex-1 truncate">{path}</code>
        <span className="hidden sm:inline text-xs text-muted-foreground max-w-[200px] truncate">{title}</span>
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4 border-t border-border/40">
              <p className="text-sm text-muted-foreground pt-4 leading-relaxed">{description}</p>

              {note && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                  <Zap className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700/80">{note}</p>
                </div>
              )}

              {headers && headers.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Headers</p>
                  <div className="space-y-1">
                    {headers.map(h => (
                      <div key={h.name} className="flex items-baseline gap-3 text-xs">
                        <code className="font-mono-data text-primary/80 bg-primary/5 px-2 py-0.5 rounded">{h.name}</code>
                        <span className="text-muted-foreground">{h.desc}</span>
                        {h.required && <span className="text-[9px] font-bold text-destructive/60 uppercase">Required</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {pathParams && pathParams.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Path Parameters</p>
                  <div className="space-y-1">
                    {pathParams.map(p => (
                      <div key={p.name} className="flex items-baseline gap-3 text-xs">
                        <code className="font-mono-data text-primary/80 bg-primary/5 px-2 py-0.5 rounded">:{p.name}</code>
                        <span className="text-muted-foreground/70 font-mono-data">{p.type}</span>
                        <span className="text-muted-foreground">{p.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {bodyParams && bodyParams.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Request Body</p>
                  <div className="space-y-1">
                    {bodyParams.map(p => (
                      <div key={p.name} className="flex items-baseline gap-3 text-xs">
                        <code className="font-mono-data text-primary/80 bg-primary/5 px-2 py-0.5 rounded">{p.name}</code>
                        <span className="text-muted-foreground/70 font-mono-data">{p.type}</span>
                        <span className="text-muted-foreground">{p.desc}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {response && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Response</p>
                  <CodeBlock code={response} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Section Group ──────────────────────────────────────────────
const ApiSection = ({ icon: Icon, title, description, children, color = "primary" }) => (
  <div className="mb-12">
    <div className="flex items-center gap-3 mb-2">
      <div className={`w-9 h-9 rounded-xl bg-${color}/10 flex items-center justify-center`}>
        <Icon className={`w-4.5 h-4.5 text-${color}`} strokeWidth={1.5} />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
    <div className="mt-4 space-y-3">
      {children}
    </div>
  </div>
);

// ─── Main Page ──────────────────────────────────────────────────
export default function ApiDocs() {
  const navigate = useNavigate();

  return (
    <div className="min-h-svh bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 backdrop-blur-2xl bg-background/80 border-b border-border/50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate("/")} className="p-2 rounded-xl hover:bg-foreground/5 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-foreground">Pramaan API</h1>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">v2.0 — RaaS Protocol</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            <span className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-success/10 text-success border border-success/20">
              Base URL: {BACKEND_URL}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Overview */}
        <motion.div
          className="mb-16"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground mb-4">
            Reputation-as-a-Service API
          </h2>
          <p className="text-muted-foreground max-w-2xl leading-relaxed mb-8">
            Integrate Pramaan's verifiable reputation infrastructure into your application.
            Query ZK-verified credit scores, trigger multi-provider verification flows,
            and access AI-powered risk analysis — all via simple REST endpoints.
          </p>

          {/* Architecture overview cards */}
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            {[
              { icon: Shield, title: "ZK-First", desc: "All proofs verified via Reclaim Protocol and Anon Aadhaar zero-knowledge circuits" },
              { icon: Server, title: "RESTful", desc: "Standard JSON API with clear request/response patterns and HTTP status codes" },
              { icon: Lock, title: "x402 Gated", desc: "Premium endpoints use HTTP 402 payment protocol — pay-per-query with on-chain USDC" },
            ].map((card, i) => (
              <motion.div
                key={card.title}
                className="glass-card p-5"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + i * 0.05 }}
              >
                <card.icon className="w-5 h-5 text-primary mb-2" strokeWidth={1.5} />
                <p className="text-sm font-semibold text-foreground mb-1">{card.title}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{card.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Quick start */}
          <div className="glass-accent p-6 rounded-3xl">
            <p className="text-sm font-semibold text-foreground mb-3">Quick Start — Fetch a Worker's Score</p>
            <CodeBlock
              language="bash"
              code={`# Fetch verified credit score for a worker
curl -X GET "${BACKEND_URL}/api/lender/worker-score/0x1588...9AE6" \\
  -H "x-api-key: pk_pramaan_demo_2026"

# Response includes composite score, breakdown, and AI analysis
# Returns HTTP 402 if x402 payment is required`}
            />
          </div>
        </motion.div>

        {/* ─── PROVIDER ENDPOINTS ─────────────────────────────── */}
        <ApiSection icon={Globe} title="Providers" description="Discover and query available verification sources">
          <Endpoint
            method="GET"
            path="/api/providers"
            title="List Active Providers"
            description="Returns all active verification providers currently configured in the RaaS platform. Each provider includes its metadata, category, scoring weight, and description. Only providers with valid Reclaim Protocol IDs are returned."
            response={`{
  "ok": true,
  "totalProviders": 4,
  "categories": {
    "developer": { "label": "Developer", "icon": "code" },
    "gig": { "label": "Gig Economy", "icon": "briefcase" },
    "financial": { "label": "Financial", "icon": "landmark" },
    "social": { "label": "Social", "icon": "users" }
  },
  "providers": [
    {
      "key": "github",
      "name": "GitHub Contributions",
      "shortName": "GitHub",
      "category": "developer",
      "weight": 0.35,
      "description": "Yearly contribution count from your GitHub profile"
    },
    {
      "key": "uber",
      "name": "Uber Driver Rating",
      "shortName": "Uber",
      "category": "gig",
      "weight": 0.25
    }
  ]
}`}
          />
        </ApiSection>

        {/* ─── VERIFICATION ENDPOINTS ─────────────────────────── */}
        <ApiSection icon={Shield} title="Verification" description="Start and monitor ZK proof verification for any provider">
          <Endpoint
            method="POST"
            path="/api/reclaim/verify/:providerKey/:walletAddress"
            title="Start Provider Verification"
            description="Initiates a Reclaim Protocol ZK verification session for the specified provider. Returns a QR code URL that the worker scans with the Reclaim app. The proof is generated on the worker's device and delivered via callback — no credentials are shared."
            pathParams={[
              { name: "providerKey", type: "string", desc: "Provider identifier (github, uber, sbi, linkedin)" },
              { name: "walletAddress", type: "address", desc: "Worker's Ethereum wallet address (0x...)" },
            ]}
            response={`{
  "ok": true,
  "provider": "github",
  "requestUrl": "https://api.reclaimprotocol.org/...",
  "statusUrl": "https://api.reclaimprotocol.org/api/sdk/session/..."
}`}
            note="The worker must scan the QR code with the Reclaim app. The proof is generated on-device using TLS proxy + ZK circuits."
          />

          <Endpoint
            method="GET"
            path="/api/reclaim/proof-status/:providerKey/:walletAddress"
            title="Check Verification Status"
            description="Poll this endpoint to check if a verification proof has been received and processed for the given provider. Returns the verification status, extracted metric, and score."
            pathParams={[
              { name: "providerKey", type: "string", desc: "Provider identifier" },
              { name: "walletAddress", type: "address", desc: "Worker's wallet address" },
            ]}
            response={`// Success
{
  "ok": true,
  "ready": true,
  "provider": "github",
  "metric": 422,
  "score": 60,
  "verifiedAt": "2026-03-25T19:01:36.000Z"
}

// Pending
{ "ok": true, "ready": false }

// Failed (Reclaim attestor error)
{
  "ok": true,
  "ready": false,
  "failed": true,
  "error": "ReclaimProofGenerationException: Protocol failed"
}`}
          />

          <Endpoint
            method="POST"
            path="/api/reclaim/provider-callback/:providerKey/:walletAddress"
            title="Proof Callback (Internal)"
            description="Webhook endpoint called by Reclaim Protocol when a ZK proof is successfully generated. This is not called directly by clients — Reclaim's infrastructure delivers the proof here automatically after the worker completes verification."
            pathParams={[
              { name: "providerKey", type: "string", desc: "Provider identifier" },
              { name: "walletAddress", type: "address", desc: "Worker's wallet address" },
            ]}
            note="This is an internal callback. You do not need to call this endpoint directly."
          />
        </ApiSection>

        {/* ─── SCORING ENDPOINTS ──────────────────────────────── */}
        <ApiSection icon={BarChart3} title="Composite Scoring" description="Calculate and mint weighted multi-source reputation scores">
          <Endpoint
            method="POST"
            path="/api/raas/composite-score/:walletAddress"
            title="Generate Composite Score"
            description="Calculates a weighted composite reputation score from all verified provider proofs for this wallet. Applies identity bonus (Anon Aadhaar), diversity bonus (multiple sources), and actuarial scoring. Optionally mints the score on-chain."
            pathParams={[
              { name: "walletAddress", type: "address", desc: "Worker's wallet address" },
            ]}
            response={`{
  "ok": true,
  "compositeScore": 78,
  "tier": "Strong",
  "baseScore": 71,
  "identityBonus": 5,
  "diversityBonus": 7,
  "sourcesVerified": 3,
  "breakdown": [
    {
      "provider": "github",
      "providerName": "GitHub Contributions",
      "category": "developer",
      "score": 60,
      "weight": 0.35,
      "weightedContribution": 21.0,
      "metric": 422,
      "metricLabel": "contributions"
    },
    {
      "provider": "uber",
      "providerName": "Uber Driver Rating",
      "category": "gig",
      "score": 90,
      "weight": 0.25,
      "weightedContribution": 22.5,
      "metric": { "rating": 4.8, "trips": 2500 }
    }
  ]
}`}
            note="The composite score uses actuarial-grade weighted averaging. Identity verification adds +5 bonus, and verifying 3+ sources adds up to +10 diversity bonus."
          />

          <Endpoint
            method="GET"
            path="/api/raas/profile/:walletAddress"
            title="Full RaaS Profile"
            description="Returns the complete RaaS profile for a wallet — including all verified providers, their individual scores, composite score, identity status, and on-chain verification state."
            pathParams={[
              { name: "walletAddress", type: "address", desc: "Worker's wallet address" },
            ]}
            response={`{
  "ok": true,
  "walletAddress": "0x1588c7C9A274BaC1f965D52838093FE871D79AE6",
  "identityVerified": true,
  "verifiedProviders": {
    "github": { "score": 60, "metric": 422, "verifiedAt": "..." },
    "uber": { "score": 90, "metric": { "rating": 4.8, "trips": 2500 } }
  },
  "compositeScore": 78,
  "tier": "Strong",
  "sourcesVerified": 2,
  "onChainScore": 78
}`}
          />
        </ApiSection>

        {/* ─── LENDER ENDPOINTS ───────────────────────────────── */}
        <ApiSection icon={CreditCard} title="Lender Bureau (x402)" description="Payment-gated access to verified worker credit reports">
          <Endpoint
            method="GET"
            path="/api/lender/worker-score/:walletAddress"
            title="Unlock Worker Credit Report"
            description="Returns a comprehensive credit report for the specified worker, including their composite score, platform data, and AI-generated risk analysis. This endpoint is gated by the x402 HTTP payment protocol — the first request returns HTTP 402 with payment instructions. After completing the USDC payment on-chain, retry with the transaction hash."
            pathParams={[
              { name: "walletAddress", type: "address", desc: "Worker's wallet address to query" },
            ]}
            headers={[
              { name: "x-api-key", desc: "Your Pramaan lender API key", required: true },
              { name: "x-payment-proof", desc: "Transaction hash of USDC payment (for retry after 402)", required: false },
            ]}
            response={`// First request → HTTP 402 Payment Required
// Headers: x-payment-address, x-payment-amount

// After payment → HTTP 200
{
  "score": 78,
  "platform": "Multi-Source RaaS",
  "details": "AI-generated credit risk analysis based on
    verified GitHub contributions (422/yr), Uber rating
    (4.8★, 2500 trips), and SBI banking data..."
}`}
            note="The x402 protocol charges 0.05 USDC (50,000 units) per query. Payment is made via ERC-20 transfer on Base Sepolia. The x-payment-proof header contains the tx hash for verification."
          />
        </ApiSection>

        {/* ─── IDENTITY ENDPOINTS ─────────────────────────────── */}
        <ApiSection icon={Users} title="Identity" description="Anon Aadhaar ZK identity verification and on-chain profile management">
          <Endpoint
            method="GET"
            path="/api/reclaim/status/:type/:walletAddress"
            title="Check Identity/Reputation Status"
            description="Returns the verification status for identity or legacy reputation verification. Detects Reclaim attestor failures and returns actionable error information."
            pathParams={[
              { name: "type", type: "string", desc: "Status type: 'identity' or 'reputation'" },
              { name: "walletAddress", type: "address", desc: "Worker's wallet address" },
            ]}
            response={`{
  "ok": true,
  "ready": true,
  "proof": { "...Reclaim proof object..." }
}`}
          />

          <Endpoint
            method="POST"
            path="/api/reclaim/generate-request/:type/:walletAddress"
            title="Generate Verification Request"
            description="Creates a new Reclaim Protocol verification session for identity or legacy reputation flows. Returns a QR code URL for the worker to scan."
            pathParams={[
              { name: "type", type: "string", desc: "'identity' or 'reputation'" },
              { name: "walletAddress", type: "address", desc: "Worker's wallet address" },
            ]}
            response={`{
  "ok": true,
  "requestUrl": "https://api.reclaimprotocol.org/...",
  "statusUrl": "https://api.reclaimprotocol.org/api/sdk/session/..."
}`}
          />
        </ApiSection>

        {/* ─── ARCHITECTURE DIAGRAM ──────────────────────────── */}
        <motion.div
          className="mt-8 mb-16"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h3 className="text-xl font-semibold text-foreground mb-6">System Architecture</h3>
          <div className="glass-card p-8">
            <div className="font-mono text-xs text-muted-foreground leading-loose">
              <pre className="overflow-x-auto">{`
┌─────────────────────────────────────────────────────────────────────┐
│                        PRAMAAN RaaS PROTOCOL                        │
├──────────────┬──────────────────────────────┬───────────────────────┤
│              │                              │                       │
│  ┌────────┐  │  ┌────────────────────────┐  │  ┌─────────────────┐  │
│  │ Worker │──┼─►│  Anon Aadhaar ZK       │  │  │  Lender Bureau  │  │
│  │  dApp  │  │  │  Identity Verification │  │  │  (x402 Gated)   │  │
│  └────┬───┘  │  └────────────────────────┘  │  └───────┬─────────┘  │
│       │      │                              │          │            │
│       ▼      │  ┌────────────────────────┐  │          ▼            │
│  ┌────────┐  │  │  Reclaim Protocol      │  │  ┌─────────────────┐  │
│  │ Multi- │──┼─►│  ZK Proof Engine       │  │  │  AI Risk Agent  │  │
│  │Provider│  │  │  (GitHub/Uber/SBI/LI)  │  │  │  (Ollama LLM)   │  │
│  │  QR    │  │  └────────────────────────┘  │  └─────────────────┘  │
│  └────┬───┘  │                              │                       │
│       │      │  ┌────────────────────────┐  │  ┌─────────────────┐  │
│       ▼      │  │  Actuarial Scoring     │  │  │  Base Sepolia   │  │
│  ┌────────┐  │  │  Composite Engine      │──┼─►│  Smart Contract │  │
│  │Passport│  │  │  (Weighted + Bonuses)  │  │  │  (Score Mint)   │  │
│  │  Card  │  │  └────────────────────────┘  │  └─────────────────┘  │
│  └────────┘  │                              │                       │
├──────────────┴──────────────────────────────┴───────────────────────┤
│  ZK-Verified  •  Privacy-First  •  On-Chain  •  Portable  •  Open  │
└─────────────────────────────────────────────────────────────────────┘
              `}</pre>
            </div>
          </div>
        </motion.div>

        {/* Error codes */}
        <motion.div
          className="mb-16"
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h3 className="text-xl font-semibold text-foreground mb-6">HTTP Status Codes</h3>
          <div className="glass-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40">
                  <th className="text-left p-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Code</th>
                  <th className="text-left p-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Meaning</th>
                  <th className="text-left p-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">Action</th>
                </tr>
              </thead>
              <tbody className="text-xs">
                {[
                  ["200", "Success", "Request completed successfully"],
                  ["400", "Bad Request", "Check your request parameters"],
                  ["402", "Payment Required", "x402: Send USDC payment, retry with x-payment-proof header"],
                  ["403", "Forbidden", "Invalid or missing x-api-key header"],
                  ["404", "Not Found", "Worker has no verified data or provider not found"],
                  ["500", "Server Error", "Internal error — retry or contact support"],
                ].map(([code, meaning, action]) => (
                  <tr key={code} className="border-b border-border/20">
                    <td className="p-4 font-mono-data font-bold text-foreground">{code}</td>
                    <td className="p-4 text-muted-foreground font-medium">{meaning}</td>
                    <td className="p-4 text-muted-foreground hidden sm:table-cell">{action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Footer */}
        <div className="text-center pt-8 pb-16 border-t border-border/40">
          <p className="text-sm text-muted-foreground mb-4">
            Need an API key? Integrate Pramaan into your lending platform.
          </p>
          <button
            onClick={() => navigate("/gateway")}
            className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95"
          >
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}
