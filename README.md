<div align="center">
  <h1>🛡️ Pramaan</h1>
  <p><strong>Decentralized Identity & Reputation Protocol for the Gig Economy</strong></p>
  
  ![Network: Sepolia](https://img.shields.io/badge/Network-Ethereum_Sepolia-blue.svg)
  ![Backend: Node.js](https://img.shields.io/badge/Backend-Node.js-339933.svg?logo=node.js)
  ![Frontend: React](https://img.shields.io/badge/Frontend-React_Vite-61DAFB.svg?logo=react)
  ![Smart Contracts: Foundry](https://img.shields.io/badge/Contracts-Foundry-B7B7B7.svg)
  <br/>
  <p><strong>🔗 Sepolia Contract Address:</strong> <a href="https://sepolia.etherscan.io/address/0x36C76e4B28997698819356C0C18e5892D168893B"><code>0x36C76e4B28997698819356C0C18e5892D168893B</code></a></p>
</div>

## 📖 Overview

**Pramaan** is a Web3 reputation flow engineered for gig workers. It establishes a privacy-preserving pipeline to bundle external real-world achievements into an immutable on-chain state, unlocking DeFi micro-loans natively.

1. 👤 **Step 1: Verify Identity** (Aadhaar Zero-Knowledge Verification)
2. 💼 **Step 2: Verify Income** (Reclaim Protocol / SBI & Uber)
3. 🏆 **Step 3: Mint Score** (An autonomous AI agent sets an on-chain Gig Score)

---

## 🏗️ Architecture & Monorepo Structure

* 📦 **`pramaan-contract/`** - Foundry smart contract project modeling EVM state & ZK verification logic.
* ⚙️ **`backend/`** - Node/Express API responsible for Reclaim webhook callbacks, deterministic Zero-Knowledge proof protocols, and the OpenClaw AI score generation agent.
* 💻 **`pramaan-app/`** - React + Vite dApp Front-end, functioning as the primary user hub (Wallet Provider + Dashboards).

> **Architectural Loop:** Frontend requests proof configurations from the backend. The backend manages the Reclaim callback pipeline or mints deterministic testing proofs. The frontend submits this verified payload directly to the `Pramaan` Smart Contract. Finally, a backend autonomous agent scores the result definitively via localized LLM evaluation.

---

## 🔌 Protocol Integrations

## Fileverse Integration (Data Storage & Portability)

### 1) How we are using it
Fileverse is integrated directly into the verification flow. Once a user completes their identity checks, income validation, and generates a Gig Score, the entire finalized state (wallet, score, verification status, and timestamp) is packaged and pushed directly to a Fileverse Local Node (`http://localhost:8001/api/ddocs`) as an encrypted dDoc.

### 2) Why we are using it
We use Fileverse to ensure **data portability and transparency**. While core states (like the Gig Score) are recorded on-chain, storing the rich metadata and complete verification context purely on Ethereum is too expensive and rigid. Fileverse allows us to store the detailed proof payload decently, scalably, and user-owned, acting as a dynamic "Pramaan Passport" that the user can share at will.

### 3) How everything gets stored properly
When the "Check My GigScore" process completes successfully on the frontend, an automated background function (`handleDebugFileverse`) bundles the user's data:
- Address & Final GigScore
- Proof hashes / ZK Commitments
- Timestamp
This JSON object is posted to the Fileverse API, which returns a unique **dDoc ID**. This ID gets stored on-chain inside the `WorkerProfile` struct so the EVM state directly points to the detailed Fileverse document. 

### 4) Access & Privacy (Data Fetching)
- **Agent Fetching:** The backend AI Agent doesn't read from Fileverse to *generate* the score; it utilizes the raw proof inputs. Fileverse is strictly the *output* data layer storing the finalized, computed score and metadata.
- **Authorized Individual Fetching:** Anyone with the specific Fileverse `dDoc ID` (or viewing the user's profile where the link is shared) can fetch the document content. The app provides a direct "View on Fileverse" button bridging users directly to `https://docs.fileverse.io/`.
- **Unauthorized Access Prevention:** Unless the specific, cryptographic `dDoc ID` identifier is shared by the worker (or retrieved via on-chain lookups intentionally exposed by the worker), the specific document link acts as an unguessable endpoint, keeping raw worker metadata obscured from blanket public scraping.

### 5) End-to-End Productive Showcase
The Fileverse workflow in Pramaan demonstrates an optimal Web3 architecture: **Compute on-chain, Store on Fileverse.** 
- It works completely end-to-end: Identity is proven (ZK/Aadhaar) $\rightarrow$ Smart Contract verifies rules $\rightarrow$ Score is computed $\rightarrow$ Full state automatically pushes to Fileverse.
- It displays seamless UX: The frontend immediately surfaces the `dDoc ID` post-computation without requiring a secondary user signature, and offers a 1-click external link to view the generated credentials.

---

## x402 Protocol (Data Monetization & Off-Chain Access)

### 1) What we did
We implemented the **x402 Micropayment Protocol** to monetarily gate our AI-powered "Deep Credit Analysis" reports. When a Lender requests an advanced risk analysis for a gig-worker's profile from our backend AI Agent, the API intercepts the request and issues an HTTP 402 "Payment Required" status, demanding a micro-transaction before serving the data.

### 2) How we integrated it
The architecture operates as a seamless fallback loop within the Lender Dashboard (`LenderDashboard.jsx`):
- **The Intercept:** The lender queries the backend endpoint `/api/lender/worker-score/:address`. Because they lack proof of payment, the Express server strictly blocks the data and forces a `402 Payment Required` response, attaching customized HTTP headers (`x-payment-address`, `x-payment-amount`, `x-payment-chain`).
- **The Payment:** The React UI instantly catches this 402 code. It parses the custom headers and securely prompts the user's MetaMask specifically requesting a USDC ERC20 transfer dynamically fetched from our Smart Contract.
- **The Unlock & Validation:** The precise microsecond the transaction is approved in the wallet, the UI recursively loops the original API request but now injects the newly formed Transaction Hash into an `x-payment-proof` header. The infrastructure immediately validates the cryptographic token transfer and streams the LLM-powered Private Data insight block.

### 3) Why we did it
Traditional alternative-credit bureaus restrict data behind aggressive monthly Web2 SaaS subscriptions, isolating access exclusively to legacy banks. With x402, we enable **Pay-Per-Compute Modularity** on-chain. It ensures that compute-intensive tasks (Local LLM/Ollama risk assessments) and access to verified Web3 data are instantly monetized precisely at the time of demand, eliminating centralized API keys entirely.

### 4) How we stand out
- **Zero-Friction UX:** It eliminates the fragmented Web3 design of "Deposit funds into a smart contract vault before use". The user hits a button, MetaMask asks for $0.05 seamlessly, and the UI immediately transforms to display the unlocked data with zero buffering lock-ups.
- **Self-Sovereign AI Economy:** Gating HTTP APIs using EVM proofs strictly adheres directly to the original utopian vision of the 'HTTP 402' internet standard—we're demonstrating a highly functional, true Web3 API economy where the platform treasury earns micro-fees directly routed per request.

---

## OpenClaw AI Agent (Autonomous Credit Auditor)

### 1) What we did
We implemented a fully autonomous, privacy-first AI Agent inspired by the OpenClaw architecture. Instead of relying on a centralized credit bureau to determine a gig worker's score, we deployed a "Deterministic Auditor" agent. This agent evaluates the worker's Zero-Knowledge identity and income proofs, synthesizes the data using a Local LLM, and mints a tamper-proof GigScore on the Ethereum Sepolia network.

### 2) How we integrated it
Due to hackathon package registry constraints with the official `@openclaw/core` library, we engineered a custom, robust local agent runtime from scratch using Node.js, Viem, and Ollama:
- **The Autonomous Intercept:** When the backend needs to score a worker, it queries the AI service. The service demands a micro-fee via the x402 protocol (HTTP 402). 
- **The Machine Wallet:** Our backend agent does not crash. It autonomously reads the 402 headers and uses `viem` to sign a smart contract transaction, paying 0.02 USDC on Base Sepolia entirely on its own.
- **The Local Brain:** Once the transaction hash is verified, the agent triggers a local instance of **Llama 3 (via Ollama)**. The LLM processes the ZK-verified platform data (e.g., Uber vs. SBI) and generates a dynamic, professional credit risk insight.

### 3) Why we did it
Traditional credit scoring is opaque, biased, and relies on vacuuming up massive amounts of sensitive user data into centralized servers. By using an autonomous OpenClaw agent, we remove human bias from the underwriting process. Furthermore, because the AI requires an on-chain x402 payment to execute, we ensure the agent service is economically sustainable and protected from spam.

### 4) How we stand out
- **100% Privacy-Preserving:** Because our agent utilizes a local Llama 3 model, absolutely no sensitive gig-worker data is ever sent to centralized cloud providers like OpenAI or Anthropic. The data stays local, and only the final score goes on-chain.
- **Machine-to-Machine Economy:** We successfully built a loop where an AI agent possesses its own wallet, encounters a paywall, and autonomously spends crypto to unlock the compute power it needs to help a human user. 
- **Verifiable Intelligence:** The agent does not read easily forged PDFs. It bases its LLM reasoning strictly on mathematically proven ZK-proofs from Anon Aadhaar and Reclaim Protocol, creating a truly trustless credit profile.

---

## 🚀 Quick Start / Development

### 1️⃣ Prerequisites
- **Node.js**: v18+ & **npm**: 9+
- **Foundry** (`forge`, `cast`) targeting contract development
- A funded EVM wallet (Sepolia recommended)
- **RPC URL** (used for backend and testnet deployment)
- *Optional:* `ngrok` (for secure public routing of real Reclaim callbacks)

### 2️⃣ Installation
From the root of the monorepo:
```bash
npm install
cd backend && npm install
cd ../pramaan-app && npm install
```

### 3️⃣ Configure Environments

<details>
<summary><b>Backend Environment (`backend/.env`)</b></summary>

```env
RECLAIM_APP_ID=
RECLAIM_APP_SECRET=
FILEVERSE_API_KEY=
CALLBACK_URL=
RECLAIM_PROVIDER_IDENTITY=5d37bfc5-a44e-43e5-b44e-9430c2192f7d
RECLAIM_PROVIDER_SBI=343537da-09a8-4b34-a1dd-06a1166ff873
RECLAIM_PROVIDER_UBER=
ENABLE_MOCK_ZK=false
ENABLE_ZK_FLOW=false
RPC_URL=
CONTRACT_ADDRESS=
AGENT_PRIVATE_KEY=
```
</details>

<details>
<summary><b>Frontend Environment (`pramaan-app/.env`)</b></summary>

```env
VITE_WALLETCONNECT_PROJECT_ID=
VITE_CONTRACT_ADDRESS=
VITE_BACKEND_URL=http://localhost:4000
VITE_USE_TEST_AADHAAR=false
VITE_ANON_NULLIFIER_SEED=1234
VITE_ENABLE_UBER_PROVIDER=false
VITE_USE_MOCK_ZK=false
VITE_USE_ZK_SUBMISSION=false
VITE_ENABLE_MOCK_IDENTITY_BUTTON=false
```
</details>

<details>
<summary><b>Smart Contract Deploy Variables</b></summary>
When running the `Deploy.s.sol` script, ensure you have:

* `PRIVATE_KEY` (Deployer)
* `AGENT_WALLET` (Backend AI Agent key mapping)
* `TREASURY_WALLET`
</details>

### 4️⃣ Deploy On-Chain Contracts
Execute within the `/pramaan-contract` project directory:
```bash
forge build
forge script script/Deploy.s.sol:Deploy --rpc-url $RPC_URL --broadcast
```
> **Important:** Post-deployment, paste the active contract address back into both `backend/.env` (as `CONTRACT_ADDRESS`) and `pramaan-app/.env` (as `VITE_CONTRACT_ADDRESS`).

### 5️⃣ Run the Stack
To replicate the full environment, utilize 3 concurrent terminal instances:

* **Terminal 1** (`backend`): `cd backend && npm start`
* **Terminal 2** (`frontend`): `cd pramaan-app && npm run dev`
* **Terminal 3** *(Optional)*: `ngrok http 4000` (Configure the resulting URL in your `backend/.env CALLBACK_URL`)

---

## 🧪 Validating Verification Flows

### Testing Route A: Zero-Knowledge Payload Generation
Leverage our engineered deterministic ZK-proofs to execute Smart Contract writes efficiently.
- Ensure Backend env: `ENABLE_ZK_FLOW=true`, `ENABLE_MOCK_ZK=true`
- Ensure Frontend env: `VITE_USE_ZK_SUBMISSION=true`, `VITE_USE_MOCK_ZK=true`

1. Web3 Login within the frontend UI.
2. Complete Identity Verification (Simulates Anon Aadhaar ZK Proofs).
3. Complete Income Validation (Simulates Uber/SBI Reclaim Protocol).
4. Assign Gig Score.

*Note: Smart Contract prevents duplicate submissions. If testing frequently, rotate to a fresh temporary EVM wallet or actively redeploy the contract to reset state constraints.*

### Testing Route B: Real Reclaim Protocol Execution
- Ensure Backend env: `ENABLE_ZK_FLOW=false` (for legacy proof mode)
- Ensure Frontend env: `VITE_USE_MOCK_ZK=false`
Ensure callbacks route cleanly to your active backend environment via an `ngrok` port tunnel. Verify health via `GET /api/reclaim/preflight`.

---

## 📡 API Reference & GigScore Logistics

**GigScore Logic Formulation:** The score runs deterministic evaluation logic directly off incoming verification vectors:
`Core Score Base + Deterministic Drift Engine mod entropy % 13`
*Total Score strictly bounded dynamically between 50 and 95 prior to mint injection by `AGENT_PRIVATE_KEY`.*

**Available Utility Endpoints:**
* `GET /health` : Verify system heartbeat
* `GET /api/reclaim/preflight` : Validation check for public accessibility parameters
* `POST /api/zk/identity-proof/:walletAddress` : Simulate Identity ZK block
* `POST /api/agent/score/:walletAddress` : Instruct Agent Pipeline

## 🔒 Security Operations
1. Always isolate `.env` keys; **Never commit** real testnet/mainnet `PRIVATE_KEY` to repository versions.
2. The AI Agent signs from its own isolated `AGENT_PRIVATE_KEY` wallet purely to execute updates inside the master `Pramaan` rule-sets.
3. Keep all Verification Payloads securely encrypted entirely as they constitute highly sensitive user metric footprints.
