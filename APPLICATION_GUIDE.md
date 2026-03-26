# Pramaan Application Operation Guide

## Complete User Guide for Workers and Lenders

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Worker Flow: Building Your Verified Identity](#worker-flow)
3. [Lender Flow: Querying Worker Profiles](#lender-flow)
4. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites

- A web3 wallet (MetaMask, RainbowKit supported)
- Base Sepolia testnet configured in your wallet
- Test ETH and USDC on Base Sepolia (for transactions and lender queries)
- A mobile device with Reclaim app installed (for proof verification)

### Accessing Pramaan

1. Navigate to `http://localhost:5173` (development) or your deployed URL
2. You will see the Pramaan landing page
3. Click "Launch App" or "Get Started" button in the hero section

---

## Worker Flow: Building Your Verified Identity

### Step 1: Connect Your Wallet

**On the Gateway page:**

1. Click "Connect Wallet" button in the top-right corner
2. Select your wallet provider (MetaMask, WalletConnect, etc.)
3. Approve the connection in your wallet extension
4. Verify you are on Base Sepolia network

You will see your wallet address displayed once connected.

### Step 2: Verify Your Identity (Aadhaar)

**Navigate to CreateIdentity page (automatic after wallet connection)**

You are now in **Step 1: Identity Verification**.

**Option A: Test Mode (Default)**

If `VITE_USE_TEST_AADHAAR=true` in your frontend environment:

1. A test Aadhaar QR code is provided automatically
2. Click "Login with Anon Aadhaar" button
3. The QR code scanner opens
4. Scan the displayed test QR with your phone (or use a QR scanner app)
5. Wait for the proof to be generated (usually 5-10 seconds)
6. You will see a success message: "Identity Verified"
7. A checkmark appears next to "Step 1" in the progress indicator

**Option B: Real Aadhaar (If enabled)**

If `VITE_USE_TEST_AADHAAR=false`:

1. Prepare your physical Aadhaar card or e-Aadhaar PDF
2. Click "Login with Anon Aadhaar"
3. Upload your Aadhaar Secure QR code (the QR printed on the card or in the PDF)
4. The QR is scanned locally on your device
5. A zero-knowledge proof is generated (no Aadhaar data leaves your device)
6. Upon success, your identity is verified on-chain

### Step 3: Verify Multi-Source Reputation

**After identity verification, you see Step 2: Income & Reputation Verification**

You now see four provider cards:

- **GitHub** (Developer category)
- **Uber** (Gig Economy category)
- **SBI Bank** (Financial category)
- **LinkedIn** (Social category)

**To verify a provider:**

1. Click on any provider card (e.g., GitHub)
2. A QR code appears with the text "Scan to verify [Provider]"
3. Open the **Reclaim Protocol app** on your mobile device
4. Tap "Scan QR" and point your camera at the QR code
5. The Reclaim app securely visits the target platform (e.g., GitHub) via TLS proxy
6. It extracts the verified metric (e.g., contribution count)
7. A zero-knowledge proof is generated on your device
8. The proof is automatically sent to the backend
9. The provider card shows a checkmark and the score (e.g., "60 points")

**Note:** The Reclaim Protocol does NOT see your login credentials. It only witnesses the data on the page and generates a proof of the specific metric.

**Verify Multiple Providers:**

You can verify as many providers as you want. Each adds:
- Points to your base score (based on the metric)
- Weight to the composite calculation
- Diversity bonus (more sources = higher bonus)

Recommended: Verify at least 2-3 providers for a strong composite score.

### Step 4: Generate Composite Score

**After verifying identity and at least one provider:**

1. Click "Generate Pramaan Score" button
2. The system calculates:
   - Base score from all verified providers (weighted average)
   - Identity bonus (+5 points for Aadhaar verification)
   - Diversity bonus (+4-10 points based on number of sources)
3. The score is computed and animated on screen (e.g., 78)
4. A tier is assigned (Exceptional, Strong, Moderate, Developing, Early-Stage)
5. A breakdown card shows:
   - Individual provider scores
   - Weighting for each provider
   - Bonuses applied
   - Your tier classification

**Minting on-chain:**

1. Behind the scenes, the backend's autonomous agent:
   - Computes the final composite score
   - Submits a transaction to the smart contract
   - Mints the score on Base Sepolia blockchain
2. You see a confirmation message with:
   - Transaction hash (clickable link to BaseScan)
   - Score successfully minted
   - Your on-chain profile is now public and verifiable

### Step 5: View Your Pramaan Passport

**On the results page (Step 3: Your Pramaan Passport):**

A passport-style card displays:

- Your wallet address (shortened, e.g., `0x1588...9AE6`)
- Your composite score (e.g., `78`)
- Your tier (e.g., `Strong`)
- Verification status badges:
  - Identity: Verified ✓ or Unverified
  - Income: Verified ✓ or Unverified
  - Network: Base Sepolia
  - Last Updated: Timestamp

Below the passport:

- **Provider Breakdown:** Individual scores for each verified provider
- **Score Analytics:** Progress bars showing your position (0-100)
- **Verification Metadata:**
  - Identity dDoc ID (reference to encrypted metadata)
  - Income dDoc ID
  - Timestamps

**Next Steps:**

1. Share your wallet address with lenders
2. Lenders can query your verified score at any time
3. Your score is on-chain and permanent (immutable)
4. You can re-verify anytime to update your score

---

## Lender Flow: Querying Worker Profiles

### Access the Lender Portal

**Option A: Direct Smart Contract Read**

If you only need the basic score (no API key required):

1. Use any blockchain explorer (e.g., BaseScan)
2. Navigate to contract `0xA450544019538B8f580A8B33D7aF69185F9e468d`
3. Call the read-only function `getGigScore(workerAddress)`
4. Returns the worker's composite score (0-100) instantly

**Option B: Lender Dashboard with AI Report**

For the full credit report including AI risk analysis:

1. Click "Lender Bureau" button on the landing page
2. Or navigate to `/lender` directly
3. You see the Lender Dashboard

### Query a Worker's Profile

**On the Lender Dashboard:**

1. Enter the worker's wallet address in the search box
   - Format: `0x...` (42 characters)
2. Click "Verify & Access Report" button
3. The frontend sends a request to the backend

### Handle Payment (First-Time Access)

**First Request Returns HTTP 402:**

The backend blocks access and returns:

- Status: 402 Payment Required
- Custom header: `x-payment-address` (treasury wallet)
- Custom header: `x-payment-amount` (0.05 USDC in base units)
- Custom header: `x-payment-chain` (8453 for Base)

The frontend detects this and:

1. Displays a payment prompt: "Pay 0.05 USDC to access this report"
2. Opens your wallet extension
3. Requests USDC ERC-20 transfer to the treasury address
4. Shows the transaction hash once confirmed

### View the Complete Report

**After payment confirmation:**

The frontend automatically retries the request with the transaction hash.

The backend validates the payment and returns:

- **Composite Score:** e.g., 78
- **Tier:** e.g., Strong
- **Verification Status:**
  - Identity Verified: Yes/No
  - Income Verified: Yes/No
  - Last Updated: Timestamp
- **Provider Breakdown:**
  - GitHub: 60 points (422 contributions, 35% weight)
  - Uber: 90 points (4.8★, 2500 trips, 25% weight)
  - SBI Bank: 75 points (75K balance, 25% weight)
  - LinkedIn: 70 points (verified, 15% weight)
- **AI Risk Analysis Report:**
  - Professional credit risk assessment (200-400 words)
  - Income stability evaluation
  - Platform diversity assessment
  - Overall creditworthiness recommendation

### Making Lending Decisions

Based on the report:

- **Exceptional (90-100):** Lowest risk. High loan approval rates.
- **Strong (75-89):** Low-to-moderate risk. Standard lending terms.
- **Moderate (55-74):** Moderate risk. Higher interest rates or collateral.
- **Developing (30-54):** Higher risk. Smaller loan amounts or co-signer.
- **Early-Stage (0-29):** Highest risk. Require additional verification.

---

## Troubleshooting

### Wallet Connection Issues

**Problem:** "Connect Wallet" button does nothing or shows error

**Solution:**
1. Ensure MetaMask or your wallet extension is installed
2. Check that you are on Base Sepolia network
3. Reload the page and try again
4. If error persists, check browser console for details
5. Try a different wallet provider

### Anon Aadhaar Verification Fails

**Problem:** QR scanner doesn't recognize the code or proof generation times out

**Solution:**
1. Ensure you are using a valid Aadhaar Secure QR (on physical card or e-Aadhaar PDF)
2. In test mode, the QR is provided automatically
3. Ensure your device has a working camera
4. Check that the Anon Aadhaar app is up to date
5. Try re-scanning or refreshing the page

### Reclaim Proof "Something Went Wrong"

**Problem:** Provider verification shows error after scanning QR

**Likely cause:** Reclaim Protocol attestor temporarily unavailable

**Solution:**
1. Wait a few minutes and retry (attestor failures are usually transient)
2. If error persists for multiple providers, check Reclaim Protocol status
3. As a fallback, you can use "Demo Data" to continue (if enabled)
4. Retry with a different provider (different attestor node)

### Score Minting Fails

**Problem:** "Composite Score could not be minted" or transaction reverted

**Likely causes:**
- Insufficient ETH for gas fees
- Score already minted within cooldown period (1 day)
- Contract error

**Solution:**
1. Ensure you have at least 0.01 ETH for gas
2. Wait at least 1 day before re-verifying the same identity
3. Check transaction hash on BaseScan for detailed error
4. Contact support with transaction hash

### Lender Payment Rejected

**Problem:** USDC transfer fails or wallet cancels transaction

**Solution:**
1. Ensure you have at least 0.05 USDC balance
2. Ensure you have enough ETH (0.001) for transaction fees
3. Approve USDC spending for the treasury contract (first time only)
4. Try again with a fresh transaction
5. Verify payment was actually submitted on BaseScan

### Worker Profile Shows "Not Found"

**Problem:** Lender gets "Worker not found" error

**Solution:**
1. Verify the wallet address is correct (case-insensitive, 42 characters)
2. Ensure the worker has completed all verification steps
3. Ensure the worker's score has been minted on-chain
4. Wait a few seconds and retry
5. Check BaseScan to confirm the worker address has an on-chain profile

### Performance Issues

**Problem:** Page is slow, QR code takes a long time to load, or transactions are stuck

**Solution:**
1. Check your internet connection (verification requires callback from backend)
2. Ensure the backend is running (`npm start` in backend directory)
3. Ensure ngrok tunnel is active (for Reclaim callbacks)
4. Reload the page and try again
5. Check that you are on Base Sepolia (not mainnet or other networks)

---

## Support & Contact

For issues or questions:

1. Check the README.md for technical details
2. Review the GitHub Issues section
3. Contact the development team via GitHub discussions

---

## Summary

**For Workers:**
1. Connect wallet
2. Verify identity (Aadhaar)
3. Verify 1-4 reputation sources (GitHub, Uber, SBI, LinkedIn)
4. Generate composite score
5. Score is minted on-chain automatically
6. Share your wallet address with lenders

**For Lenders:**
1. Access lender portal
2. Enter worker wallet address
3. Pay 0.05 USDC (first time only, via x402 protocol)
4. Receive full credit report with AI analysis
5. Make lending decisions based on verified data

**Key Principles:**
- Privacy first: No passwords shared, no data sent to central servers
- Transparency: All actions on-chain and auditable
- Portability: Scores work across any platform or lender
- Ownership: Workers control their identity and credentials

