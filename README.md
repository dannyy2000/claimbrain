# CLAIMBRAIN

> **Your claim. Handled by an agent. Paid in seconds.**

CLAIMBRAIN is an autonomous insurance settlement protocol built on [Somnia's Agentic L1](https://somnia.network). It stores insurance policy rules as a living, queryable brain onchain. When a real-world event occurs, an AI agent reads live data, reasons over the policy rules, and executes the payout automatically — no forms, no adjusters, no waiting.

Built for the [Somnia Agentathon](https://www.encodeclub.com/programmes/agentathon) — May 20 to June 10, 2026.

---

## The Problem

Insurance claims take 7–30 days to settle despite being based on objective, publicly verifiable data.

- Your flight was delayed 5 hours. The airline recorded it. The data is public. You still wait 30 days and fill out 4 forms to get $200.
- A DeFi protocol you trusted was exploited. The hack is permanently on the blockchain. You still wait for a committee of humans to vote on whether your loss qualifies.
- A farmer's crops failed because rainfall dropped below the threshold. Satellite data confirms it. An insurance assessor still travels to the farm weeks later.

The data is always there. The rules are always known. The only thing missing is a system that acts on them automatically.

---

## The Solution

CLAIMBRAIN has three layers that work together:

```
POLICY BRAIN      →      AI AGENT      →      SMART CONTRACT
(onchain rules)      (reads + reasons)        (executes payout)
```

### Layer 1 — The Policy Brain

The Policy Brain is a smart contract that stores insurance rules as structured, queryable, onchain knowledge.

Instead of rules living in a PDF that a human adjuster reads slowly, they live onchain — transparent, immutable, and readable by AI agents in milliseconds.

```
Rule #1:  delay_hours > 3  AND  cause != "weather"      →  pay $200
Rule #2:  delay_hours > 6  AND  cause != "weather"      →  pay $400
Rule #3:  claims_this_year > 3                          →  flag fraud
Rule #4:  customer_tier == "VIP"                        →  multiply 1.5x
Rule #5:  season == "holiday" AND storm_cat >= 3        →  override weather exclusion
```

Every rule is:
- **Permanent** — stored onchain, cannot be secretly changed
- **Auditable** — full history of when rules were added or updated
- **Queryable** — the AI agent reads and reasons over rules for every claim
- **Transparent** — customers can read the exact rules before buying a policy

### Layer 2 — The AI Agent

The agent is the intelligence between the real world and the blockchain. It runs autonomously — no human triggers it.

**What the agent does every 5 minutes:**

1. Reads all active policies onchain
2. For each policy, queries the relevant external data source
3. If a trigger condition is met, initiates a claim automatically
4. Queries the Policy Brain — applies rules, handles exceptions, checks fraud flags
5. Submits the decision back to the smart contract with full evidence

**What makes this possible on Somnia:**

Somnia's Agentic L1 allows smart contracts to natively query external APIs and run AI inference onchain — all validated by multiple validators through consensus. There is no trusted oracle middleman. The agent's decision is as trustworthy as any onchain transaction.

### Layer 3 — The Smart Contract (Insurance Pool)

The Insurance Pool contract:
- Holds the capital that pays out claims
- Receives the agent's verified decision
- Executes the payout to the claimant's wallet automatically
- Logs every claim, decision, and payout permanently onchain

---

## How It Works — Full Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    USER BUYS A POLICY                       │
│         Pays premium → policy stored onchain                │
└──────────────────────────┬──────────────────────────────────┘
                           │
                    (user does nothing else)
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              AI AGENT MONITORING LOOP                       │
│         Runs every 5 minutes, watches all policies          │
└──────────────────────────┬──────────────────────────────────┘
                           │
              Event detected (flight delayed)
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              AGENT READS THE WORLD                          │
│    Queries AviationStack API → confirms 5hr delay           │
│    Cause: mechanical. Not weather.                          │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              AGENT CHECKS POLICY BRAIN                      │
│    Rule #2 applies: 5hrs mechanical → $400                  │
│    Rule #3: only 1 claim this year, no fraud flag           │
│    Rule #4: VIP customer → 1.5x multiplier                  │
│    Decision: pay $600                                       │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│           SOMNIA VALIDATORS CONFIRM DECISION                │
│    Multiple nodes independently verify agent output         │
│    Consensus reached → decision is trustworthy              │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              SMART CONTRACT EXECUTES                        │
│    $600 USDC sent to user's wallet                          │
│    Claim logged onchain with full evidence trail            │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              USER RECEIVES PAYMENT                          │
│    Never filed a claim. Never had to.                       │
│    Total time: under 60 seconds.                            │
└─────────────────────────────────────────────────────────────┘
```

---

## Use Cases

### 1. Flight Delay Insurance
**Trigger:** Flight delayed beyond policy threshold
**Data source:** AviationStack / FlightAware API
**Brain rules:** Duration thresholds, cause classification (weather vs mechanical), VIP multipliers, fraud detection
**Demo:** User buys a $5 policy. Flight delays 5 hours. Agent detects it, checks the brain, pays $400 to wallet. User was still at the gate.

### 2. DeFi Protocol Hack Coverage
**Trigger:** Smart contract exploit confirmed onchain
**Data source:** DeFiLlama API + on-chain transaction data
**Brain rules:** TVL drop threshold, exploit classification, holding period requirements (anti-gaming), max payout caps
**Demo:** User covers $10,000 in a DeFi protocol. Protocol is exploited. Agent reads onchain data, confirms hack, verifies user held 45+ days, pays $10,000. Resolved in 8 minutes vs Nexus Mutual's 2-3 days.

---

## Why CLAIMBRAIN vs Everything Else

| | Traditional Insurance | Simple Parametric (Etherisc) | CLAIMBRAIN |
|---|---|---|---|
| Settlement time | 7–30 days | Minutes | Under 60 seconds |
| Rules flexibility | Human-interpreted | Hardcoded if/else | Dynamic Policy Brain |
| Handles exceptions | Yes (slowly) | No | Yes (AI reasoning) |
| Fraud detection | Manual | None | Onchain history check |
| Audit trail | Internal PDFs | Transaction visible | Full reasoning trail onchain |
| Who triggers the claim | User files a form | User submits a transaction | Agent detects automatically |
| Trust model | Trust the company | Trust the oracle | Consensus-validated AI |

---

## Why Somnia

CLAIMBRAIN uses three Somnia-specific capabilities that make this impossible to build on any other chain:

| Somnia Feature | How CLAIMBRAIN Uses It |
|---|---|
| **Onchain API querying** | Agent reads flight data, DeFi TVL, weather APIs — no trusted oracle middleman |
| **Onchain AI inference** | Agent reasons over complex policy rules with exceptions and edge cases — validated by consensus |
| **Multi-validator consensus** | Every agent decision is verified by multiple Somnia nodes — as trustworthy as any blockchain transaction |
| **1M TPS + sub-second finality** | Claims settle in seconds, not minutes — monitoring loop runs every 5 minutes cost-effectively |

---

## Architecture

```
claimbrain/
├── contracts/              Solidity smart contracts
│   └── src/
│       ├── PolicyBrain.sol         Stores and manages policy rules onchain
│       ├── InsurancePool.sol       Holds capital, executes payouts
│       ├── ClaimRegistry.sol       Logs all claims and decisions
│       └── interfaces/
│           ├── IPolicyBrain.sol
│           └── IInsurancePool.sol
│
├── agent/                  Autonomous AI agent (TypeScript)
│   └── src/
│       ├── index.ts                Entry point — starts monitoring loop
│       ├── monitor.ts              Watches active policies every 5 minutes
│       ├── brain.ts                Queries Policy Brain, applies rules
│       ├── sources/
│       │   ├── flightData.ts       AviationStack API integration
│       │   └── defiData.ts         DeFiLlama + onchain data integration
│       └── types/
│           └── index.ts
│
├── frontend/               React frontend
│   └── src/
│       ├── pages/
│       │   ├── Home.tsx            Landing page
│       │   ├── BuyPolicy.tsx       Purchase flow
│       │   └── Claims.tsx          Claim history + status
│       └── components/
│           ├── PolicyCard.tsx
│           ├── ClaimStatus.tsx
│           └── AgentLog.tsx        Live agent reasoning log
│
└── docs/
    ├── architecture.md
    └── policy-brain-spec.md
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Blockchain | Somnia Mainnet (Chain ID: 5031) |
| Smart Contracts | Solidity 0.8.x + Hardhat |
| Agent Runtime | TypeScript + Somnia Agent Kit |
| LLM | OpenAI GPT-4o (via Somnia Agent Kit) |
| External Data | AviationStack API, DeFiLlama API |
| Frontend | React + ethers.js + TailwindCSS |
| Wallet | MetaMask (EVM-compatible) |

---

## Network Details

**Somnia Mainnet**
```
RPC URL:    https://api.infra.mainnet.somnia.network
Chain ID:   5031
Symbol:     SOMI
Explorer:   https://explorer.somnia.network
```

**Somnia Testnet (Shannon)**
```
Chain ID:   50312
Explorer:   https://shannon-explorer.somnia.network
```

---

## Getting Started

### Prerequisites
- Node.js v18+
- MetaMask with Somnia Mainnet added
- SOMI tokens for gas ([bridge here](https://docs.somnia.network/get-started/bridging-info))

### Installation

```bash
git clone https://github.com/dannyy2000/claimbrain.git
cd claimbrain
npm install
```

### Environment Variables

```bash
cp .env.example .env
```

Fill in:
```
SOMNIA_RPC_URL=https://api.infra.mainnet.somnia.network
PRIVATE_KEY=your_deployer_wallet_private_key
OPENAI_API_KEY=your_openai_api_key
AVIATIONSTACK_API_KEY=your_aviationstack_api_key
DEFILLAMA_API_URL=https://api.llama.fi
```

### Deploy Contracts

```bash
cd contracts
npm run deploy --network somnia
```

### Run the Agent

```bash
cd agent
npm run start
```

### Run the Frontend

```bash
cd frontend
npm run dev
```

---

## How to Create a Policy (For Policy Makers)

```solidity
// Add a rule to the Policy Brain
policyBrain.addRule(
    policyId,
    "delay_hours > 3 AND cause != weather",
    400,        // payout amount in USDC
    "FLIGHT_DELAY_STANDARD"
);

// Fund the insurance pool
insurancePool.fundPool{ value: poolAmount }(policyId);
```

---

## Judging Criteria Alignment

| Criterion | How CLAIMBRAIN Addresses It |
|---|---|
| **Functionality** | Two live policy types (flight delay + DeFi hack), fully deployed on Somnia mainnet, demoed with real flight numbers |
| **Agent-First Design** | Agent monitors continuously — zero human trigger after policy purchase. Uses Somnia's native API querying and onchain AI inference |
| **Innovation** | Policy Brain is a novel primitive — dynamic, queryable onchain rules that agents reason over. Nobody has built this on any chain |
| **Autonomous Performance** | Agent runs 24/7 monitoring loop, handles edge cases with retry logic, logs full reasoning trail onchain for judge audit |

---

## Roadmap

**Hackathon (3 weeks)**
- [x] Policy Brain contract
- [x] Insurance Pool contract
- [x] Flight Delay agent + AviationStack integration
- [x] DeFi Hack agent + DeFiLlama integration
- [x] Autonomous monitoring loop
- [x] React frontend
- [x] Deployed on Somnia mainnet

**Post-Hackathon**
- [ ] Permissionless policy creation (anyone can deploy a policy module)
- [ ] Crop insurance module (satellite data integration)
- [ ] Gig worker income protection module
- [ ] Governance for Policy Brain rule proposals
- [ ] Cross-chain coverage

---

## Team

Built by **Daniel Akinsanya** ([@dannyy2000](https://github.com/dannyy2000)) for the Somnia Agentathon 2026.

---

## License

MIT
