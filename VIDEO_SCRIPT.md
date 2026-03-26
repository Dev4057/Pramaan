# Pramaan: Decentralized Reputation Protocol - Video Script

## Duration: 3-4 Minutes | Target: 700 Words

---

## SECTION 1: INTRODUCTION (0:00 - 0:30)

**[SCENE: Clean landing page with Pramaan logo]**

**NARRATOR:**
"Meet Pramaan. A decentralized reputation protocol for the gig economy.

Three hundred million gig workers globally have a problem: They build years of credibility on platforms like Uber, GitHub, and Upwork. But when they move to a new platform or apply for a loan, that reputation disappears. They start from zero.

Traditional credit scores don't capture gig income. Banks reject workers despite proven earning histories across multiple platforms.

Pramaan solves this. It aggregates verified reputation from multiple sources into a single, portable, on-chain credit identity."

---

## SECTION 2: HOW IT WORKS - WORKER FLOW (0:30 - 1:45)

**[SCENE: Gateway page with wallet connection button]**

**NARRATOR:**
"Let's walk through the process. First, a worker connects their wallet. They navigate to the Pramaan protocol and begin verification."

**[SCENE: CreateIdentity page - Step 1: Identity Verification]**

**NARRATOR:**
"Step One: Identity Verification. The worker uploads their Aadhaar Secure QR code. Using zero-knowledge proofs, the protocol verifies the government-issued identity without ever seeing the Aadhaar number, name, or address. The data never leaves the worker's device.

The protocol generates a cryptographic proof of identity and submits it to the blockchain."

**[SCENE: Provider cards grid showing GitHub, Uber, SBI, LinkedIn]**

**NARRATOR:**
"Step Two: Multi-Source Reputation Verification. The worker now connects external platforms. Let's start with GitHub.

The worker clicks the GitHub card. A QR code appears. They scan it with the Reclaim Protocol app on their phone."

**[SCREEN: Show QR code animation]**

**NARRATOR:**
"The Reclaim app securely visits GitHub on their behalf, witnesses the page through a TLS proxy, and verifies their contribution count: 422 contributions. A zero-knowledge proof is generated proving this metric without sharing any credentials.

The proof is delivered to the backend, verified, and the score is calculated. For GitHub contributions, 422 merits a score of 60 points in the developer category."

**[SCENE: Provider card shows checkmark and score]**

**NARRATOR:**
"The same process repeats for additional platforms. Uber: The driver rating is verified at 4.8 stars with 2,500 completed trips. That's a gig economy score of 90. SBI Bank: Monthly income of 75,000 rupees is verified. That's a financial score of 75.

Each provider has a different weight in the final score calculation. The composite algorithm combines these weighted scores, adds bonuses for identity verification and multi-source diversity, and produces a single number: 78.

Tier: Strong. Four sources verified."

**[SCENE: Animated score card showing 78 with breakdown]**

**NARRATOR:**
"The score is automatically minted on-chain on Base Sepolia blockchain. Immutable. Portable. The worker now owns their verifiable credit identity. No platform can take it away."

---

## SECTION 3: HOW IT WORKS - LENDER FLOW (1:45 - 3:00)

**[SCENE: Lender Dashboard page]**

**NARRATOR:**
"Now, let's switch perspective. A lender wants to query a worker's credit profile. They navigate to the Lender Dashboard.

They enter the worker's wallet address and request verification."

**[SCENE: Query input and button click]**

**NARRATOR:**
"The system returns HTTP 402: Payment Required. The lender needs to pay a small USDC fee to access the verified data. This is the x402 Micropayment Protocol -- the internet's native payment standard.

The lender's wallet prompts a USDC transfer of 0.05 cents. They approve it."

**[SCENE: Wallet popup showing USDC transfer]**

**NARRATOR:**
"Once the transaction is confirmed on-chain, the backend delivers the complete credit report: The worker's composite score of 78. Identity verified. Four providers verified. Last updated today.

But there's more. An autonomous AI agent has generated a deep credit risk analysis. It examines the verified data -- income stability, platform diversity, verification recency -- and synthesizes a professional risk assessment.

All without sending any data to external servers. The AI runs locally using Llama 3. Complete privacy. Complete transparency."

**[SCENE: Expanded credit report showing AI analysis]**

**NARRATOR:**
"The lender now has trustworthy, verified data. They can make lending decisions based on real evidence, not historical credit scores that exclude gig workers."

---

## SECTION 4: KEY BENEFITS & CLOSING (3:00 - 3:45)

**[SCENE: Split screen showing multiple use cases]**

**NARRATOR:**
"What makes Pramaan different?

First: Privacy. Zero-knowledge proofs mean no passwords are shared. No personal data is sent to centralized servers. Verification happens on the device.

Second: Portability. The score lives on-chain. A worker can present their Pramaan credential to any platform, any lender, any employer that reads the smart contract. No permission from Pramaan required.

Third: Transparency. Every verification, every score update, every lender query is logged on the blockchain. Complete audit trail. No hidden algorithms.

Fourth: Self-Sovereignty. Workers own their identity. They control what data is shared and with whom. They can revoke access at any time.

Fifth: Economic Opportunity. Lenders pay per query. Workers benefit from their own verified data. Platforms can integrate at no cost. The protocol creates a fair, market-driven reputation economy."

**[SCENE: Back to landing page with hero section]**

**NARRATOR:**
"Pramaan is live on Base Sepolia testnet. Anyone can create their verifiable identity today.

For gig workers: Build portable credit history. Unlock access to better lending rates.

For lenders: Access verified reputation data. Make data-driven decisions. Pay only for what you use.

For platforms: Integrate verified scores seamlessly. No credential management required.

Pramaan. Your work is your credit."

**[SCENE: Fade to logo and project URLs]**

---

## TIMING BREAKDOWN

| Section | Duration | Word Count |
|---------|----------|-----------|
| Introduction | 0:30 | 95 words |
| Worker Flow (Identity) | 0:25 | 85 words |
| Worker Flow (Multi-Provider) | 0:35 | 145 words |
| Worker Flow (Scoring & Minting) | 0:15 | 60 words |
| Lender Flow (Query & Payment) | 0:35 | 135 words |
| Lender Flow (Report & AI) | 0:25 | 85 words |
| Benefits & Closing | 0:45 | 155 words |
| **TOTAL** | **3:45** | **760 words** |

---

## VISUAL ASSETS NEEDED (Per Scene)

1. Pramaan landing page (hero section)
2. Gateway page (wallet connection)
3. CreateIdentity page (Step 1 - Aadhaar verification)
4. Provider cards grid (GitHub, Uber, SBI, LinkedIn)
5. QR code generation animation
6. Score card with breakdown (78 points, tier display)
7. Lender Dashboard interface
8. Query input form
9. Wallet approval popup (showing USDC transfer)
10. Expanded credit report with AI analysis
11. Project logos and blockchain icons
12. Animated data flow diagrams (optional)

---

## DELIVERY TIPS

**Pacing:** Speak at 180-190 words per minute for professional delivery. Pause 2-3 seconds at key moments (after score reveal, after blockchain confirmation).

**Tone:** Calm, authoritative, educational. Avoid hype language. Focus on technical capability and real-world impact.

**Graphics Overlays:** Show numbers prominently (78 score, 4.8 rating, 422 contributions, 0.05 USDC fee). Use color-coded provider categories (Developer=green, Gig=orange, Financial=blue, Social=purple).

**Audio:** Use subtle background music during transitions. No sound effects on interactions; keep focus on narration.

**Call to Action:** End with clear URLs: GitHub repo, testnet contract address, demo link.

