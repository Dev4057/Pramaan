# Pramaan

Pramaan is a Web3 reputation flow for gig workers:

- Step 1: verify identity (Aadhaar path)
- Step 2: verify income (SBI/Uber path)
- Step 3: assign an on-chain Gig Score

The repository contains a Solidity contract, an Express backend, and a React frontend.

## Monorepo Structure

- `pramaan-contract/` - Foundry smart contract project
- `backend/` - Node/Express API for Reclaim callbacks, mock proof packs, and score assignment
- `pramaan-app/` - React + Vite dApp UI (wallet connect + worker dashboard)

## Architecture at a Glance

1. Frontend requests proof or proof-pack from backend.
2. Backend either:
   - creates Reclaim request URLs (real flow), or
   - returns deterministic mock ZK proof-packs (mock ZK flow).
3. Frontend submits proof data to `Pramaan` contract.
4. Backend agent wallet sets the Gig Score on-chain after verification.

## Prerequisites

- Node.js 18+
- npm 9+
- Foundry (`forge`, `cast`) for contract work
- A funded EVM wallet (Sepolia recommended)
- RPC URL (for backend + contract deployment)
- Optional: ngrok for public callback URL in real Reclaim mode

## 1) Install Dependencies

From repository root:

```bash
npm install
cd backend && npm install
cd ../pramaan-app && npm install
```

## 2) Configure Environment Variables

### Backend env

Create `backend/.env` (copy from `backend/.env.example`) and fill:

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

Notes:

- Set `CALLBACK_URL` to your backend public URL when using Reclaim callbacks.
- For local testing with ngrok: `CALLBACK_URL=https://<your-ngrok-id>.ngrok-free.app`.
- `AGENT_PRIVATE_KEY` is used by backend to call `setGigScore`.
- Enable ZK + mock mode with:
  - `ENABLE_ZK_FLOW=true`
  - `ENABLE_MOCK_ZK=true`

### Frontend env

Create `pramaan-app/.env` (copy from `pramaan-app/.env.example`) and fill:

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

Recommended for local mock ZK flow:

```env
VITE_USE_MOCK_ZK=true
VITE_USE_ZK_SUBMISSION=true
VITE_ENABLE_MOCK_IDENTITY_BUTTON=true
```

### Contract deployment env (Foundry script)

For `pramaan-contract/script/Deploy.s.sol`, provide:

- `PRIVATE_KEY` - deployer key
- `AGENT_WALLET` - backend agent wallet address
- `TREASURY_WALLET` - treasury address

## 3) Deploy Contract

From `pramaan-contract/`:

```bash
forge build
forge script script/Deploy.s.sol:Deploy --rpc-url $RPC_URL --broadcast
```

Copy deployed contract address into:

- `backend/.env` as `CONTRACT_ADDRESS`
- `pramaan-app/.env` as `VITE_CONTRACT_ADDRESS`

If you redeploy, update both places.

## 4) Run the Stack (3 terminals)

Terminal 1 - backend:

```bash
cd backend
npm start
```

Terminal 2 - frontend:

```bash
cd pramaan-app
npm run dev
```

Terminal 3 - optional ngrok (real Reclaim flow):

```bash
ngrok http 4000
```

Set backend `CALLBACK_URL` to the ngrok HTTPS URL and restart backend.

## Testing Flows

### A) Mock ZK flow (fastest local testing)

Use these toggles:

- Backend: `ENABLE_ZK_FLOW=true`, `ENABLE_MOCK_ZK=true`
- Frontend: `VITE_USE_ZK_SUBMISSION=true`, `VITE_USE_MOCK_ZK=true`

Then:

1. Connect wallet in frontend.
2. Step 1: verify identity.
3. Step 2: verify income.
4. Step 3: assign score.

Important behavior:

- Mock proof-packs are deterministic per wallet/provider.
- Re-submitting Step 2 with the same wallet/provider can hit replay protection (`nullifier already used`).
- UI now re-checks on-chain state and marks Step 2 done when income was already verified.

To fully retest from scratch:

- use a fresh wallet, or
- redeploy contract (clears on-chain state for new address), and update envs.

### B) Real Reclaim flow

Use these toggles:

- Backend: `ENABLE_ZK_FLOW=false` for legacy proof-hash mode, or `true` if your verifier path is ready.
- Frontend: keep `VITE_USE_MOCK_ZK=false`.

Checklist:

1. Backend `/api/reclaim/preflight` should report callback healthy.
2. `RECLAIM_APP_ID` and `RECLAIM_APP_SECRET` must be set.
3. Provider IDs must be valid in backend env.
4. Keep backend reachable at `CALLBACK_URL` during scan/authorization.

## Gig Score Generation

Gig score is assigned by backend route:

- `POST /api/agent/score/:walletAddress`

Current logic in backend:

- choose base score by platform:
  - SBI -> 72
  - Uber -> 68
  - Unknown -> 62
- derive deterministic drift from proof hash entropy: `drift = entropy % 13`
- clamp final score between 50 and 95

Formula:

```text
score = clamp(base + drift, 50, 95)
```

After calculation, backend submits `setGigScore(worker, score)` using `AGENT_PRIVATE_KEY`.

## Useful Backend Endpoints

- `GET /health`
- `GET /api/reclaim/preflight`
- `POST /api/reclaim/identity-request`
- `POST /api/reclaim/generate-request`
- `GET /api/reclaim/status/identity/:walletAddress`
- `GET /api/reclaim/status/income/:walletAddress`
- `POST /api/zk/identity-proof/:walletAddress` (mock ZK mode)
- `POST /api/zk/income-proof/:walletAddress` (mock ZK mode)
- `POST /api/agent/score/:walletAddress`

## Troubleshooting

### Income tx fails with `Nullifier already used`

Cause:

- replay protection in contract prevented duplicate income proof/nullifier.

What to do:

- refresh dashboard and let on-chain sync mark Step 2 done if already verified,
- use a fresh wallet for a truly new run,
- or redeploy contract and update env contract addresses.

### Callback URL not reachable

- Run ngrok for port 4000.
- Set `CALLBACK_URL` to ngrok HTTPS URL.
- Verify `GET /api/reclaim/preflight` reports `callbackHealthy: true`.

### Score assignment fails

- Check `RPC_URL`, `CONTRACT_ADDRESS`, `AGENT_PRIVATE_KEY` in backend env.
- Ensure agent wallet has gas funds.
- Ensure worker is verified before Step 3.

## Project Scripts

Backend (`backend/package.json`):

- `npm start`

Frontend (`pramaan-app/package.json`):

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run preview`

Contract (`pramaan-contract/`):

- `forge build`
- `forge test`
- `forge script ... --broadcast`

## Security Notes

- Never commit real private keys or secrets.
- Use separate agent wallet with minimal required funds.
- Treat all proof payloads as sensitive data.

---

If you want, this README can be followed by:

- a root-level `Makefile` for one-command local startup,
- a `.env.example` at root that points to each subproject,
- and a CI workflow that runs frontend build + contract tests automatically.
