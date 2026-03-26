# Pramaan

**Decentralized Reputation-as-a-Service (RaaS) Protocol for the Gig Economy**

![Network: Base Sepolia](https://img.shields.io/badge/Network-Base_Sepolia-0052FF.svg)
![Backend: Node.js](https://img.shields.io/badge/Backend-Express.js-339933.svg?logo=node.js)
![Frontend: React](https://img.shields.io/badge/Frontend-React_19-61DAFB.svg?logo=react)
![Contracts: Foundry](https://img.shields.io/badge/Contracts-Foundry-B7B7B7.svg)
![ZK: Anon Aadhaar](https://img.shields.io/badge/ZK-Anon_Aadhaar-7B3FE4.svg)
![Proofs: Reclaim Protocol](https://img.shields.io/badge/Proofs-Reclaim_Protocol-FF6B35.svg)

**Contract Address (Base Sepolia):** [`0xA450544019538B8f580A8B33D7aF69185F9e468d`](https://sepolia.basescan.org/address/0xA450544019538B8f580A8B33D7aF69185F9e468d)

---

## Table of Contents

- [What is Pramaan](#what-is-pramaan)
- [Why On-Chain Reputation](#why-on-chain-reputation)
- [System Architecture](#system-architecture)
- [Zero-Knowledge Proof Integration](#zero-knowledge-proof-integration)
- [Reputation-as-a-Service (RaaS)](#reputation-as-a-service-raas)
- [Provider Registry and Scoring Engine](#provider-registry-and-scoring-engine)
- [Smart Contract Design](#smart-contract-design)
- [Database Layer](#database-layer)
- [x402 Payment Protocol](#x402-payment-protocol)
- [AI Risk Analysis Agent](#ai-risk-analysis-agent)
- [Platform Integration Guide](#platform-integration-guide)
- [API Reference](#api-reference)
- [Developer Guide](#developer-guide)
- [Security Considerations](#security-considerations)
- [License](#license)

---

## What is Pramaan

Pramaan is a decentralized protocol that aggregates verified reputation data from multiple real-world platforms (GitHub, Uber, SBI Bank, LinkedIn) into a single, portable, on-chain credit identity for gig workers. It uses zero-knowledge proofs to verify data without exposing personal information, computes a weighted composite score using an actuarial engine, and mints the result on Base L2 as an immutable credit identity.

The protocol solves a fundamental problem: 300 million gig workers globally have no portable proof of their work history. Every new platform starts their reputation from zero. Traditional credit scores do not capture gig economy income, resulting in high loan rejection rates for workers who have proven earning histories across multiple platforms.

Pramaan operates as a three-step pipeline:

1. **Identity Verification** -- The worker proves their identity using Anon Aadhaar zero-knowledge proofs. No personal data leaves their device.
2. **Multi-Source Reputation Verification** -- The worker connects platforms (GitHub, Uber, SBI Bank, LinkedIn) via Reclaim Protocol ZK proofs. Each platform's data is verified through TLS proxy attestation.
3. **Composite Score Minting** -- An actuarial scoring engine computes a weighted composite score across all verified sources, adds identity and diversity bonuses, and mints the result on-chain.

Lenders and platforms can then query this verified score via a payment-gated API (x402 protocol), paying per query in USDC.

---

## Why On-Chain Reputation

Storing reputation scores on-chain addresses three critical problems that off-chain alternatives cannot solve:

**Portability.** An on-chain score is not locked to any single platform. A worker verified on Pramaan can present their score to any lender, employer, or platform that reads the smart contract. There is no vendor lock-in and no API dependency on Pramaan's servers being online.

**Immutability.** Once minted, a score cannot be retroactively altered by any party, including Pramaan itself. The smart contract enforces this guarantee. A lender querying the contract can trust that the score was computed from verified data at a specific timestamp.

**Composability.** On-chain scores can be consumed by other smart contracts directly. A DeFi lending protocol can read a worker's Pramaan score in the same transaction that issues a micro-loan, without any off-chain API call or oracle dependency.

The smart contract is deployed on Base Sepolia (Ethereum L2), which provides low gas costs (typically under $0.01 per transaction) while inheriting Ethereum's security guarantees.

---

## System Architecture

Pramaan is structured as a three-module monorepo:

```
pramaan/
  pramaan-app/        React + Vite frontend (worker and lender interfaces)
  backend/            Express.js API server (proof management, scoring, AI agent)
  pramaan-contract/   Foundry smart contracts (on-chain state and verification logic)
```

### Data Flow

```
                                    Reclaim Protocol
                                    (TLS Attestor Nodes)
                                          |
                                          v
Worker Device                      Backend API Server                  Base Sepolia
+-----------+    QR Scan     +-------------------------+         +------------------+
| React App | ------------> | Express.js              |         | Pramaan Contract |
| (Browser) |               | - Proof callbacks       | ------> | - WorkerProfile  |
|           | <------------ | - Actuarial scoring     |  mint   | - GigScore       |
+-----------+  score result | - Provider registry     |         | - Verification   |
      |                     | - AI risk analysis      |         +------------------+
      |                     +-------------------------+               |
      |                            |           |                      |
      v                            v           v                      v
 Anon Aadhaar              PostgreSQL     Pending Proofs        Lender Query
 (Local ZK)                (Supabase)     (File-based)         (x402 gated)
```

**Frontend** requests proof configurations from the backend and renders QR codes for the worker to scan with their mobile device. The worker's phone generates the ZK proof via Reclaim Protocol's TLS proxy, which is delivered to the backend via HTTP callback. The frontend submits verified identity data directly to the smart contract. The backend's autonomous agent then computes and mints the composite score.

---

## Zero-Knowledge Proof Integration

Pramaan uses two distinct ZK proof systems, each serving a different purpose:

### Anon Aadhaar (Identity Layer)

Anon Aadhaar is a zero-knowledge protocol for verifying Indian national identity (Aadhaar) without revealing any personal information. When a worker uploads their Aadhaar Secure QR code, the following happens entirely on their device:

1. The QR code is decoded to extract the UIDAI-signed data.
2. A ZK-SNARK circuit verifies the RSA signature against the UIDAI public key.
3. The circuit produces a proof that the worker possesses a valid Aadhaar, along with selective disclosures (e.g., age above 18).
4. The proof is submitted to the smart contract. The Aadhaar number, name, address, and photo never leave the device.

The `AnonAadhaarProvider` in the frontend is configured with a `nullifierSeed` that ensures one Aadhaar can only be linked to one wallet address, preventing sybil attacks.

### Reclaim Protocol (Reputation Layer)

Reclaim Protocol enables zero-knowledge verification of any HTTPS-accessible data. For each reputation provider (GitHub, Uber, SBI, LinkedIn), the flow works as follows:

1. The backend initializes a Reclaim session with the provider's specific claim template (e.g., "GitHub yearly contributions page").
2. The worker scans a QR code with the Reclaim app on their phone.
3. The Reclaim app opens the target website (e.g., github.com) through a TLS proxy run by decentralized attestor nodes.
4. The attestor nodes witness the TLS session and verify that the response matches the claim template, without seeing the full page content.
5. A ZK proof is generated on the worker's device attesting to the specific data point (e.g., contribution count = 422).
6. The proof is delivered to the backend via HTTP callback, where it is verified and the metric is extracted.

This architecture means the worker never shares their GitHub password, Uber login, or bank credentials with Pramaan. The attestor nodes see only enough to verify the claim, and the final proof reveals only the specific metric (contribution count, driver rating, account balance).

---

## Reputation-as-a-Service (RaaS)

Pramaan operates as a RaaS platform, meaning any application can integrate verified reputation data through a standardized API. The RaaS architecture consists of three components:

### Provider Registry

A pluggable registry (`backend/src/config/providers.js`) that defines all verification sources. Each provider specifies:

- A unique key and Reclaim Protocol provider ID
- Category classification (developer, gig, financial, social)
- Scoring weight in the composite calculation
- Metric extraction logic specific to that provider's data format
- Scoring function that maps raw metrics to a 0-100 score

Adding a new provider requires only adding an entry to the registry with these fields. No changes to the API routes or frontend are needed -- the system dynamically adapts to the active provider set.

### Composite Scoring Engine

The actuarial scoring engine (`backend/src/services/ActuarialScoring.js`) computes a weighted composite score:

```
Base Score = (Sum of provider_score * provider_weight) / (Sum of active_weights)
Identity Bonus = +5 points if Anon Aadhaar verified
Diversity Bonus = +4 (2 sources) | +7 (3 sources) | +10 (4+ sources)
Composite Score = min(Base Score + Identity Bonus + Diversity Bonus, 100)
```

The score is classified into tiers:

| Tier | Score Range | Interpretation |
|------|-----------|----------------|
| Exceptional | 90-100 | Top-tier verified reputation across multiple categories |
| Strong | 75-89 | Solid multi-source verification with consistent performance |
| Moderate | 55-74 | Adequate verification with room for additional sources |
| Developing | 30-54 | Early verification with limited source coverage |
| Early-Stage | 0-29 | Minimal verification, single source or low metrics |

### On-Chain Minting

After computation, the composite score is minted on Base Sepolia via the `updateGigScore` contract function, called by the backend's autonomous agent wallet. The transaction hash is logged in the audit trail.

---

## Provider Registry and Scoring Engine

### Active Providers

| Provider | Category | Weight | What It Verifies | Scoring Tiers |
|----------|----------|--------|-----------------|---------------|
| GitHub | Developer (35%) | 0.35 | Yearly contribution count | 1000+ = 95, 500+ = 80, 250+ = 60, 100+ = 40, >0 = 20 |
| Uber | Gig Economy (25%) | 0.25 | Driver rating + trip count | Rating component (4.8+ = 50pts) + Trip component (5000+ = 50pts) |
| SBI Bank | Financial (25%) | 0.25 | Account balance or monthly income | 100K+ = 90, 50K+ = 75, 25K+ = 60, 10K+ = 40, >0 = 20 |
| LinkedIn | Social (15%) | 0.15 | Connection count or profile verification | 500+ = 85, 200+ = 65, 100+ = 45, verified profile = 70 |

### Metric Extraction

Each provider has a custom extraction function that parses the Reclaim proof's `claimData.parameters` field. The parameters contain a JSON object with `paramValues` holding the verified data. For example, a GitHub proof contains `paramValues.contributions`, while an Uber proof contains `paramValues.rating` and `paramValues.trips`.

The extraction logic handles multiple data formats since Reclaim proofs can encode parameters differently depending on the provider template version.

---

## Smart Contract Design

The `Pramaan.sol` contract manages the on-chain state for all worker profiles.

### WorkerProfile Struct

```solidity
struct WorkerProfile {
    bool identityVerified;        // Anon Aadhaar ZK proof submitted
    bool incomeVerified;          // Reclaim income/reputation proof submitted
    uint8 gigScore;               // Composite score (0-100)
    uint256 lastUpdated;          // Timestamp of last score update
    uint256 revision;             // Profile version counter
    string identityDdocId;        // Fileverse document ID for identity metadata
    string incomeDdocId;          // Fileverse document ID for income metadata
    string platform;              // Platform identifier string
    string identityProofHash;     // Hash of identity proof for verification
    string incomeProofHash;       // Hash of income proof for verification
    bytes32 identityNullifier;    // ZK nullifier preventing double-use
    bytes32 incomeNullifier;      // ZK nullifier preventing double-use
    bytes32 identityCommitment;   // ZK commitment for identity circuit
    bytes32 incomeCommitment;     // ZK commitment for income circuit
    bool exists;                  // Whether the profile has been created
    uint256 expiresAt;            // Score expiration timestamp
    bool isDefaulted;             // Whether the worker has defaulted
}
```

### Key Functions

| Function | Access | Description |
|----------|--------|-------------|
| `submitIdentity(ddocId, proofHash)` | Worker | Submit identity verification proof |
| `submitIncome(ddocId, platform, proofHash)` | Worker | Submit income/reputation verification proof |
| `submitIdentityZK(proof, publicSignals, ddocId)` | Worker | Submit ZK identity proof with on-chain verification |
| `submitIncomeZK(proof, publicSignals, ddocId, platform)` | Worker | Submit ZK income proof with on-chain verification |
| `updateGigScore(worker, score, dataHash)` | AI Agent only | Update worker's composite score |
| `verifyWorker(workerAddress)` | Lender (pays USDC fee) | Pay to verify and access worker's score |
| `isVerified(worker)` | Public (view) | Check if worker has completed all verification steps |
| `getGigScore(worker)` | Public (view) | Read worker's current composite score |
| `getWorkerProfile(worker)` | Public (view) | Read complete worker profile |

### Access Control

- **Owner:** Can set ZK verifier contracts, update verification fees, set treasury address, configure cooldown periods, and transfer admin rights.
- **AI Agent:** A dedicated wallet (`AGENT_PRIVATE_KEY`) authorized exclusively to call `updateGigScore`. This wallet is funded separately and operates autonomously from the backend.
- **Workers:** Can submit their own identity and income proofs. Cannot modify scores.
- **Lenders:** Can call `verifyWorker` after paying the USDC verification fee.

---

## Database Layer

Pramaan uses PostgreSQL (hosted on Supabase) via Prisma ORM for storing off-chain metadata. The database complements on-chain state -- it stores data that would be too expensive to store on-chain but is needed for the application layer.

### Schema

**User**
```
walletAddress   String    Primary key, unique identifier
nullifierHash   String    Unique -- enforces one human per wallet (from ZK proof)
isHuman         Boolean   Verified human status
createdAt       DateTime  Registration timestamp
```

The `nullifierHash` field is critical for sybil resistance. When a worker verifies their Aadhaar via Anon Aadhaar, the ZK circuit produces a nullifier derived from the Aadhaar data and the application's nullifier seed. This nullifier is deterministic (same Aadhaar always produces the same nullifier) but unlinkable to the Aadhaar number. Storing it ensures one Aadhaar cannot be used to create multiple accounts.

**ScoreProfile**
```
id              UUID      Auto-generated primary key
walletAddress   String    Foreign key to User (unique, 1:1 relation)
computedScore   Int       Last computed composite score
aiRiskReport    String    Full text of AI-generated risk analysis
lastTxHash      String    Transaction hash of the most recent on-chain score mint
expiresAt       DateTime  Score expiration date
isDefaulted     Boolean   Whether the worker has defaulted on obligations
updatedAt       DateTime  Auto-updated timestamp
```

The `aiRiskReport` field stores the complete LLM-generated risk analysis text. This is stored off-chain because it can be several paragraphs long and would be prohibitively expensive to store in contract storage.

**AuditLog**
```
id              UUID      Auto-generated primary key
walletAddress   String    Indexed -- which wallet performed the action
action          String    Action type (identity_verified, provider_verified, score_minted, lender_query, demo_used)
provider        String    Optional -- which provider was used (github, uber, sbi, linkedin)
details         String    Optional -- JSON metadata about the action
ipAddress       String    Optional -- request origin IP
txHash          String    Optional -- associated transaction hash
createdAt       DateTime  Indexed -- when the action occurred
```

The audit log provides a complete history of every verification, scoring, and query event. This is essential for compliance and debugging. Every action that modifies state or accesses protected data is logged.

### What Is Not Stored in the Database

- Raw Aadhaar data, bank balances, or platform credentials -- these never leave the worker's device.
- Reclaim proof contents -- proofs are processed in memory and only the extracted metric and score are persisted.
- Private keys or wallet seeds -- the backend uses environment variables for the agent wallet.

### Pending Proof State

In addition to PostgreSQL, the backend maintains a file-based JSON store (`data/pending-proofs.json`) for tracking in-progress verification sessions. This is used because Reclaim proof callbacks can arrive at any time, and the mapping between sessions and wallets must persist across server restarts. Once a proof is verified and the score is minted, the relevant entry is updated but retained for status polling.

---

## x402 Payment Protocol

The x402 protocol implements HTTP 402 (Payment Required) as a machine-readable payment gate for API access. When a lender queries a worker's credit report:

1. The lender calls `GET /api/lender/worker-score/:walletAddress` with their API key.
2. The server returns HTTP 402 with custom headers: `x-payment-address` (treasury wallet), `x-payment-amount` (fee in USDC base units), `x-payment-chain` (chain ID).
3. The lender's frontend prompts a USDC ERC-20 transfer for the specified amount (0.05 USDC per query).
4. The lender retries the same request with the transaction hash in the `x-payment-proof` header.
5. The server verifies the on-chain payment and returns the full credit report including the AI risk analysis.

This model replaces traditional SaaS subscriptions with pay-per-query pricing. Lenders pay only for the data they consume, and the payment is verifiable on-chain.

---

## AI Risk Analysis Agent

The backend includes an autonomous AI agent that generates credit risk reports using a local LLM (Llama 3 via Ollama). The agent:

1. Receives a scoring request for a worker.
2. Collects all verified proof data (platform metrics, verification timestamps, identity status).
3. Feeds the data into Ollama's Llama 3 model running locally.
4. Generates a structured risk analysis report covering income stability, platform diversity, verification recency, and overall creditworthiness.
5. If Ollama is unavailable, falls back to a deterministic rule-based report.
6. Mints the computed score on-chain using its dedicated agent wallet.

The agent is privacy-preserving by design: all LLM inference happens locally. No worker data is sent to external AI providers.

---

## Platform Integration Guide

### For Lenders (Querying Verified Scores)

To integrate Pramaan scores into a lending platform:

**Option A: Direct Smart Contract Read**

Read the score directly from the smart contract. No API key or payment required for basic score reads.

```javascript
import { createPublicClient, http } from 'viem';
import { baseSepolia } from 'viem/chains';

const client = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org')
});

// Check if worker is fully verified
const isVerified = await client.readContract({
  address: '0xA450544019538B8f580A8B33D7aF69185F9e468d',
  abi: PramaanABI,
  functionName: 'isVerified',
  args: ['0xWorkerAddress']
});

// Read composite score (0-100)
const score = await client.readContract({
  address: '0xA450544019538B8f580A8B33D7aF69185F9e468d',
  abi: PramaanABI,
  functionName: 'getGigScore',
  args: ['0xWorkerAddress']
});
```

**Option B: REST API with AI Report (x402 Gated)**

For the full credit report including AI risk analysis:

```bash
curl -X GET "https://your-backend/api/lender/worker-score/0xWorkerAddress" \
  -H "x-api-key: your_api_key"

# Returns 402 with payment instructions on first call
# After USDC payment, retry with:
curl -X GET "https://your-backend/api/lender/worker-score/0xWorkerAddress" \
  -H "x-api-key: your_api_key" \
  -H "x-payment-proof: 0xTransactionHash"
```

### For Data Providers (Adding New Verification Sources)

To add a new reputation source to the Pramaan registry, add an entry to `backend/src/config/providers.js`:

```javascript
newProvider: {
  id: process.env.RECLAIM_PROVIDER_NEW || 'reclaim-provider-id',
  name: 'Provider Display Name',
  shortName: 'Provider',
  category: 'developer',       // developer | gig | financial | social
  weight: 0.20,                // weight in composite score (0-1)
  description: 'What this provider verifies',
  metricLabel: 'metric_name',

  extractMetric(params) {
    // params contains the merged Reclaim proof parameters
    // Return the raw metric value
    return params.paramValues?.metricField || 0;
  },

  scoreMetric(value) {
    // Map raw metric to 0-100 score
    if (value >= 1000) return 95;
    if (value >= 500) return 75;
    return Math.min(Math.round(value / 10), 50);
  },
}
```

The system automatically detects providers with valid Reclaim IDs in the environment and exposes them through the `/api/providers` endpoint and the frontend provider grid. No additional route configuration is needed.

### For DeFi Protocols (On-Chain Composability)

Other smart contracts can read Pramaan scores directly:

```solidity
interface IPramaan {
    function isVerified(address _worker) external view returns (bool);
    function getGigScore(address _worker) external view returns (uint8);
}

contract LendingPool {
    IPramaan public pramaan;

    function requestLoan(uint256 amount) external {
        require(pramaan.isVerified(msg.sender), "Not verified");
        uint8 score = pramaan.getGigScore(msg.sender);
        require(score >= 55, "Score too low");
        // Issue loan based on score tier
    }
}
```

---

## API Reference

Base URL: `http://localhost:4000` (development)

### Provider Discovery

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/providers` | List all active verification providers with metadata, categories, and weights |

### Verification Flow

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/reclaim/verify/:providerKey/:walletAddress` | Start a Reclaim verification session for a specific provider. Returns QR code URL. |
| GET | `/api/reclaim/proof-status/:providerKey/:walletAddress` | Poll verification status. Returns `{ ready, failed, score, metric }`. |
| POST | `/api/reclaim/provider-callback/:providerKey/:walletAddress` | Internal webhook -- Reclaim delivers proofs here automatically. |

### Composite Scoring

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/raas/composite-score/:walletAddress` | Calculate weighted composite score from all verified providers and mint on-chain. |
| GET | `/api/raas/profile/:walletAddress` | Full RaaS profile: all verified providers, scores, tier, on-chain state. |

### Lender Bureau (x402 Gated)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/lender/worker-score/:walletAddress` | Full credit report with AI risk analysis. Requires API key. Returns 402 on first call with payment instructions. |

### Identity (Legacy)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/reclaim/generate-request/:type/:walletAddress` | Generate verification request (type: identity or reputation). |
| GET | `/api/reclaim/status/:type/:walletAddress` | Check identity/reputation verification status. |

### Administration

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/stats` | Platform statistics: total users, scores minted, provider breakdown. |
| GET | `/api/admin/audit-logs` | Query audit log with optional filters. |

---

## Developer Guide

### Prerequisites

- Node.js v18 or later
- npm 9 or later
- Foundry (forge, cast, anvil) for smart contract development
- A funded wallet on Base Sepolia (for contract deployment and agent operations)
- PostgreSQL database (Supabase free tier works)
- ngrok (for receiving Reclaim Protocol callbacks during development)
- Ollama with Llama 3 (optional, for AI risk reports; falls back to deterministic reports)

### Installation

```bash
# Clone the repository
git clone git@github.com:Dev4057/Pramaan.git
cd Pramaan

# Install root dependencies
npm install

# Install backend dependencies
cd backend
npm install
npx prisma generate
cd ..

# Install frontend dependencies
cd pramaan-app
npm install
cd ..
```

### Environment Configuration

**Backend (`backend/.env`):**

```env
# Reclaim Protocol credentials (get from dev.reclaimprotocol.org)
RECLAIM_APP_ID=
RECLAIM_APP_SECRET=

# Public URL for Reclaim callbacks (use ngrok in development)
CALLBACK_URL=https://your-ngrok-url.ngrok-free.app

# Smart contract
CONTRACT_ADDRESS=0xA450544019538B8f580A8B33D7aF69185F9e468d
BASE_RPC_URL=https://sepolia.base.org

# Agent wallet (private key for the autonomous scoring agent)
AGENT_PRIVATE_KEY=

# Reclaim provider IDs
RECLAIM_PROVIDER_IDENTITY=5d37bfc5-a44e-43e5-b44e-9430c2192f7d
RECLAIM_PROVIDER_SBI=343537da-09a8-4b34-a1dd-06a1166ff873
RECLAIM_PROVIDER_UBER=f8c4365f-8c3d-40ea-a078-29f4b59aeec5
RECLAIM_PROVIDER_LINKEDIN=b16c6781-4411-4bde-b1e6-c041df573f95

# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# Feature flags
ENABLE_MOCK_ZK=false
ENABLE_ZK_FLOW=true

# Lender API keys (comma-separated)
LENDER_API_KEYS=pk_pramaan_demo_2026

# AI agent (optional)
ELSA_API_URL=https://x402-api.heyelsa.ai
ELSA_MAX_USD_PER_CALL=0.05
```

**Frontend (`pramaan-app/.env`):**

```env
VITE_WALLETCONNECT_PROJECT_ID=       # Get from cloud.walletconnect.com
VITE_CONTRACT_ADDRESS=0xA450544019538B8f580A8B33D7aF69185F9e468d
VITE_BACKEND_URL=http://localhost:4000
VITE_USE_TEST_AADHAAR=true           # Set to false for real Aadhaar verification
VITE_ANON_NULLIFIER_SEED=1234
VITE_USE_MOCK_ZK=false
VITE_USE_ZK_SUBMISSION=true
```

### Running the Development Stack

Open three terminal windows:

```bash
# Terminal 1: Start ngrok tunnel (required for Reclaim callbacks)
ngrok http 4000
# Copy the HTTPS URL to backend/.env CALLBACK_URL

# Terminal 2: Start backend
cd backend
npm start
# Server runs on http://localhost:4000

# Terminal 3: Start frontend
cd pramaan-app
npm run dev
# App runs on http://localhost:5173
```

### Database Setup

```bash
cd backend

# Generate Prisma client
npx prisma generate

# Run migrations (creates tables in your PostgreSQL database)
npx prisma db push

# Optional: Open Prisma Studio to inspect data
npx prisma studio
```

### Smart Contract Development

```bash
cd pramaan-contract

# Build contracts
forge build

# Run tests
forge test

# Deploy to Base Sepolia
forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://sepolia.base.org \
  --broadcast \
  --verify
```

After deployment, update `CONTRACT_ADDRESS` in both `backend/.env` and `pramaan-app/.env`.

### Testing Verification Flows

**With Real Reclaim Proofs:**

1. Ensure `CALLBACK_URL` points to your running ngrok tunnel.
2. Start the backend and frontend.
3. Connect a wallet and complete identity verification (uses test Aadhaar QR by default).
4. Click a provider card (GitHub, Uber, SBI, LinkedIn) to start verification.
5. Scan the QR code with the Reclaim app on your phone.
6. The proof is delivered via callback and the score is computed automatically.

**With Demo Data (when Reclaim attestors are unavailable):**

Set `ENABLE_MOCK_ZK=true` in `backend/.env`. If a Reclaim verification fails (attestor downtime), the frontend will show a "Use Demo Data" option that uses realistic mock data for demonstration purposes. Real proofs always take priority when available.

### Project Structure Reference

```
pramaan/
  backend/
    index.js                    Main Express server (all API routes)
    prisma/
      schema.prisma             Database schema
    src/
      config/
        providers.js            Provider registry (GitHub, Uber, SBI, LinkedIn)
        prisma.js               Prisma client singleton
      services/
        ActuarialScoring.js     Composite scoring engine
        AgentReport.js          AI risk report generation (Ollama)
    data/
      pending-proofs.json       In-progress verification sessions

  pramaan-app/
    src/
      pages/
        Index.jsx               Landing page
        Gateway.jsx             Entry point / wallet connection
        CreateIdentity.jsx      Worker verification flow
        VerifyIdentity.jsx      Lender verification portal
        LenderDashboard.jsx     Lender dashboard with x402 payment
        AdminDashboard.jsx      Admin analytics and audit logs
        ApiDocs.jsx             Interactive API documentation
      components/
        HeroSection.jsx         Landing page hero with animations
        ProblemSection.jsx      Problem statement
        SolutionSection.jsx     How-it-works flow
        FeaturesSection.jsx     Platform capabilities grid
        CTASection.jsx          Call-to-action section
        WorkerDashboard.jsx     Worker profile and score display
        LenderVerify.jsx        Lender verification UI
        ErrorBoundary.jsx       React error boundary
      abi/
        Pramaan.json            Smart contract ABI

  pramaan-contract/
    src/
      Pramaan.sol               Main smart contract
    script/
      Deploy.s.sol              Deployment script
```

---

## Security Considerations

**Private Key Isolation.** The `AGENT_PRIVATE_KEY` controls a dedicated wallet used only for `updateGigScore` calls. It should hold minimal funds (enough for gas) and should never be the contract owner or hold user funds. If compromised, the attacker can only update scores, not drain funds.

**Rate Limiting.** The backend enforces 1000 requests per 15 minutes globally and 30 requests per 15 minutes on verification endpoints. This prevents abuse of Reclaim Protocol sessions and protects against denial-of-service.

**Proof Verification.** Reclaim proofs are verified by the attestor network before delivery. The backend validates proof structure but relies on Reclaim's attestor consensus for data authenticity. Anon Aadhaar proofs are verified cryptographically against UIDAI's RSA public key.

**Nullifier-Based Sybil Resistance.** Each Aadhaar generates a deterministic nullifier via the ZK circuit. The smart contract stores used proof hashes to prevent replay. The database stores nullifier hashes to prevent one identity from creating multiple accounts.

**Environment Variables.** Never commit `.env` files. The repository includes `.env.example` files with placeholder values. All secrets (private keys, API keys, database URLs) must be configured per-environment.

**USDC Fee Protection.** The `verifyWorker` function requires an ERC-20 approval and transfer before returning data. The contract validates the payment amount and transfers it to the treasury. This prevents unauthorized access to verified worker data.

---

## License

This project was built for the hackathon ecosystem. See individual dependency licenses for third-party terms.
