# CLAIMBRAIN

> **The onchain AI reasoning protocol for insurance. Not another parametric contract.**

CLAIMBRAIN is an autonomous insurance settlement protocol built on [Somnia's Agentic L1](https://somnia.network). It is not a product. It is infrastructure — an open protocol that any insurance product on Somnia deploys on top of.

It uses Somnia's most advanced agent capability — `inferToolsChat` with `onchainTools` — to give an LLM agent live access to smart contract functions mid-reasoning. The agent does not read a static string of rules. It calls the Policy Brain contract itself, queries what it needs, reasons with chain-of-thought, and returns a constrained decision. Everything is onchain. Everything is consensus-validated. No human is in the loop after the policy is purchased.

Built for the [Somnia Agentathon](https://www.encodeclub.com/programmes/agentathon) — May 20 to June 10, 2026.

---

## The Problem

Insurance claims take 7–30 days despite being based on objective, verifiable data.

**DeFi hack coverage today (Nexus Mutual):**
- A protocol is exploited. The transaction is on the blockchain. The TVL drop is publicly visible.
- You still wait 2–3 days for 50+ humans to vote on whether your loss qualifies.
- The committee can be slow, politically influenced, or simply wrong.
- $500M+ in coverage, and the best resolution time is still measured in days.

**Flight delay insurance today (Etherisc, everyone):**
- Your flight is 5 hours late. The delay is recorded by the airline. It is public data.
- You still fill out forms. You wait. You follow up. Maybe you get paid in 30 days.

**What both have in common:**
The data already exists. The rules are already known. The only missing piece is a system intelligent enough to reason over complex rules — with exceptions, fraud checks, and edge cases — and act on them autonomously.

Simple parametric contracts cannot do this. They handle one condition. They break on nuance.

CLAIMBRAIN solves this with a living onchain Policy Brain and an LLM agent that reasons over it as a live tool.

---

## What Makes CLAIMBRAIN Different

### Every Other Project Executes. CLAIMBRAIN Reasons.

```
Every other insurance project:
  if (tvl_drop > 80%) { pay(coverageAmount); }
  That is an if/else dressed up as a "smart contract."

CLAIMBRAIN:
  TVL dropped 83%. Agent checks: was this a legitimate exploit
  or a rug pull? Did the user hold for 7+ days (anti-gaming)?
  Is there a fraud flag on this wallet? Which rule tier applies?
  Does any exception override the base rule?
  Given all of that — APPROVE $10,000.
```

The difference is a calculator versus a lawyer. Both give you an answer. One understands the problem.

---

### Five Reasons We Stand Out

**1. We use `inferToolsChat` with `onchainTools` — nobody else will**

Somnia's LLM Inference base agent has four methods. Every other team will use `inferString` — passing rules as a static string. We use `inferToolsChat` with custom `onchainTools`, which registers our Policy Brain contract as a live tool the LLM calls mid-reasoning.

The agent decides what it needs. It calls `getRules(policyId)`. It calls `getFraudHistory(address)`. It calls `getCustomerTier(address)`. It gets live onchain data back, adjusts its reasoning, and returns a decision. The agent is genuinely agentic — not a fancy if/else.

Judges who built this system will immediately recognise that we understand it at a deeper level than every other submission.

**2. The full reasoning trail lives onchain**

With `chainOfThought: true` on every LLM call, every step of the agent's reasoning is permanently written to Somnia. Not just the transaction. The thinking.

```
"Rule 2 applied: TVL drop was 83%, exceeding the 80% threshold.
 Rule 3 did not apply: exploit confirmed via DeFiLlama, not a rug pull.
 Anti-gaming check passed: wallet held for 45 days, minimum is 7.
 Fraud flag: no previous claims this year.
 Decision: APPROVE — $10,000 to 0xABC..."
```

Any judge, regulator, or user can read exactly why a claim was settled or rejected. No other project has this.

**3. Two Somnia base agents chained in a single claim flow**

Every other project makes one agent call. We chain two:

```
JSON API Request agent  →  fetches live TVL / flight data
        ↓ callback
LLM Inference agent     →  reasons over Policy Brain tools + evidence
        ↓ callback
Smart contract          →  executes payout
```

Each agent's callback triggers the next. Confirmed as the correct pattern by Somnia's engineering team in their first technical workshop. Nobody else will implement this chain.

**4. Policy Brain is open infrastructure — not hardcoded rules**

Every other insurance project hardcodes rules into the contract. When rules change, they redeploy. When edge cases arise, they break.

CLAIMBRAIN's Policy Brain is a separate, permissionless smart contract. Rules are stored as structured onchain data. Anyone can deploy a policy module using the Policy Brain. Rules update without redeployment. The agent calls the Brain as a live tool every single time.

We ship two modules at launch — DeFi Hack and Flight Delay. The protocol is open for anyone to add more.

**5. We beat the best existing protocol on its own terms**

Nexus Mutual is the benchmark for onchain insurance. $500M+ in coverage. For a DeFi hack claim:

| | Nexus Mutual | CLAIMBRAIN |
|---|---|---|
| Resolution time | 2–3 days | Under 10 minutes |
| Human involvement | 50+ token holders vote | Zero |
| Decision transparency | Committee summary | Full chain-of-thought onchain |
| Data source trust | Human judgment | Consensus-validated AI |
| Rule flexibility | Community governance | Dynamic Policy Brain |

---

## How It Works — Full Flow

### Primary Demo: DeFi Hack Coverage

```
┌──────────────────────────────────────────────────────────┐
│              USER BUYS A POLICY                          │
│  Covers $10,000 in Protocol X. Pays $15/month premium.   │
│  Premium priced dynamically by agent reading protocol    │
│  risk score before purchase.                             │
│  Policy stored onchain. User does nothing else.          │
└─────────────────────────┬────────────────────────────────┘
                          │
              [Exploit happens on Protocol X]
                          │
┌─────────────────────────▼────────────────────────────────┐
│         MONITORING CONTRACT DETECTS TRIGGER              │
│  Reads active policies. Protocol X flagged.              │
│  Calls initiateClaim() automatically.                    │
└─────────────────────────┬────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────┐
│    AGENT STEP 1 — JSON API REQUEST BASE AGENT            │
│  createRequest(JSON_API_AGENT_ID, fetchString payload)   │
│  → Queries DeFiLlama API for Protocol X TVL              │
│  → Validators reach consensus on the API response        │
│  → handleTVLData() callback fires                        │
└─────────────────────────┬────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────┐
│    AGENT STEP 2 — LLM INFERENCE BASE AGENT               │
│  (Called from inside handleTVLData callback)             │
│                                                          │
│  inferToolsChat() with onchainTools:                     │
│    tool[0]: getRules(policyId)                           │
│    tool[1]: getFraudHistory(claimant)                    │
│    tool[2]: getCustomerTier(claimant)                    │
│                                                          │
│  LLM reasons:                                            │
│    → calls getRules() → "TVL drop >80% = full cover"     │
│    → calls getFraudHistory() → "0 previous claims, clean"│
│    → calls getCustomerTier() → "standard tier"           │
│    → chainOfThought logged: step-by-step reasoning       │
│    → allowedValues: ["APPROVE","REJECT","FLAG_FRAUD"]    │
│                                                          │
│  Validators reach consensus on LLM output               │
│  → handleDecision() callback fires                       │
└─────────────────────────┬────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────┐
│              SMART CONTRACT EXECUTES                     │
│  Decision: "APPROVE"                                     │
│  InsurancePool sends $10,000 USDC to user wallet         │
│  ClaimRegistry logs: decision + full reasoning trail     │
└─────────────────────────┬────────────────────────────────┘
                          │
┌─────────────────────────▼────────────────────────────────┐
│              USER RECEIVES $10,000                       │
│  Never filed a claim. Never had to.                      │
│  Full reasoning trail permanently on Somnia.             │
│  Time elapsed: under 10 minutes.                         │
│  Nexus Mutual: 2–3 days, 50 humans.                      │
└──────────────────────────────────────────────────────────┘
```

### Secondary Demo: Flight Delay Insurance

```
User buys $5 policy for flight AA123.
Agent detects 5hr mechanical delay via AviationStack API.
LLM calls Policy Brain tools: getRules(), getFraudHistory(), getCustomerTier().
chainOfThought: "Rule 2 (5hrs mechanical = $400). VIP multiplier applies. Pay $600."
$600 hits wallet before user lands.
```

---

## The Multi-Agent Chain — Technical Detail

CLAIMBRAIN chains two Somnia base agents through callbacks. Each agent completes before the next is invoked. Confirmed pattern from Somnia's engineering team.

```
[1] initiateClaim()
      └─ createRequest(JSON_API_AGENT_ID, handleTVLData.selector, payload)

[2] handleTVLData() callback
      └─ reads TVL data from response
      └─ registers Policy Brain as onchainTools[]
      └─ createRequest(LLM_INFERENCE_AGENT_ID, handleDecision.selector, payload)

[3] handleDecision() callback
      └─ decodes "APPROVE" / "REJECT" / "FLAG_FRAUD"
      └─ insurancePool.executePayout() or flagForReview()
      └─ claimRegistry.logDecision() — reasoning trail stored
```

Context is preserved between callbacks using a `mapping(uint256 => ClaimContext)` keyed by `requestId`.

---

## The Policy Brain — Open Protocol

The Policy Brain is a standalone smart contract that any insurance module on CLAIMBRAIN uses.

Rules are stored as structured onchain data — not hardcoded in contract logic. They are queryable by the LLM agent as live onchain tools. They update without redeployment.

```solidity
struct Rule {
    uint256 ruleId;
    uint256 policyId;
    string  condition;      // human-readable
    uint256 payoutAmount;   // USDC, 6 decimals
    string  ruleType;       // STANDARD | EXCEPTION | FRAUD_FLAG | MULTIPLIER
    uint256 priority;       // higher = evaluated first
    bool    active;
    uint256 createdAt;
    address createdBy;
}
```

**DeFi Hack Module — Rules**
```
STANDARD   (p1):  tvl_drop >= 80% AND exploit_confirmed          → full coverage
STANDARD   (p2):  tvl_drop >= 50% AND exploit_confirmed          → 60% coverage
EXCEPTION  (p10): holding_days < 7                               → REJECT (anti-gaming)
EXCEPTION  (p10): event_type == RUG_PULL                         → REJECT (excluded)
FRAUD_FLAG (p20): claims_this_year >= 2                          → FLAG
STANDARD   (p3):  tvl_drop >= 80% AND resolved_within_10min      → coverage + 10% speed bonus
```

**Flight Delay Module — Rules**
```
STANDARD   (p1):  delay_hours >= 2 AND cause != WEATHER          → $100
STANDARD   (p2):  delay_hours >= 4 AND cause != WEATHER          → $200
STANDARD   (p3):  delay_hours >= 8 AND cause != WEATHER          → $400
EXCEPTION  (p10): cause == WEATHER                               → REJECT
EXCEPTION  (p15): season == HOLIDAY AND storm_cat >= 3           → override weather exclusion
FRAUD_FLAG (p20): claims_this_year >= 3                          → FLAG
MULTIPLIER (p5):  customer_tier == VIP                           → 1.5x payout
```

---

## Somnia Base Agents Used

CLAIMBRAIN uses Somnia's pre-built base agents — called directly from Solidity via the platform contract.

**Platform Contract**
```
Mainnet:  0x5E5205CF39E766118C01636bED000A54D93163E6
Testnet:  0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776
```

**Agent 1 — JSON API Request**
```
ID:       13174292974160097713
Used for: Fetching live TVL from DeFiLlama, flight status from AviationStack
Method:   fetchString(url, dotNotationSelector) → string
```

**Agent 2 — LLM Inference**
```
ID:       12847293847561029384
Used for: Reasoning over Policy Brain rules, fraud detection, decision making
Method:   inferToolsChat(roles, messages, mcpUrls, onchainTools, maxIterations, chainOfThought)
Key args: onchainTools = [getRules, getFraudHistory, getCustomerTier]
          chainOfThought = true  (reasoning trail stored onchain)
          allowedValues = ["APPROVE", "REJECT", "FLAG_FRAUD"]
```

---

## Why CLAIMBRAIN vs Everything Else

| | Traditional Insurance | Etherisc / Simple Parametric | Nexus Mutual | CLAIMBRAIN |
|---|---|---|---|---|
| Settlement time | 7–30 days | Minutes | 2–3 days | Under 10 minutes |
| Human involvement | Adjusters + admin | None | 50+ voters | Zero |
| Rule complexity | Full | One condition | Community vote | Dynamic Policy Brain |
| Exceptions handled | Yes (slowly) | No | Partially | Yes — AI reasons |
| Fraud detection | Manual review | None | Claim history check | Onchain history + LLM reasoning |
| Audit trail | Internal PDF | Transaction only | Investigation PDF | Full chain-of-thought onchain |
| Who triggers claim | User files form | User submits tx | User files claim | Agent detects automatically |
| Trust model | Trust the company | Trust the oracle | Trust the voters | Consensus-validated AI |
| Open protocol | No | No | No | Yes — anyone deploys modules |

---

## Architecture

```
claimbrain/
├── contracts/
│   └── src/
│       ├── ClaimBrain.sol          Core contract — agent chain orchestrator
│       ├── PolicyBrain.sol         Open rule storage — queryable as onchain tool
│       ├── InsurancePool.sol       Capital pool — executes payouts
│       ├── ClaimRegistry.sol       Permanent log of claims + reasoning trails
│       ├── modules/
│       │   ├── DefiHackModule.sol  DeFi hack policy configuration
│       │   └── FlightDelayModule.sol  Flight delay policy configuration
│       └── interfaces/
│           ├── IAgentRequester.sol Somnia platform interface
│           ├── IPolicyBrain.sol
│           └── IInsurancePool.sol
│
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── Home.tsx            Landing — protocol overview
│       │   ├── BuyPolicy.tsx       Policy purchase flow
│       │   ├── Claims.tsx          Claim history + status
│       │   └── AgentLog.tsx        Live chain-of-thought reasoning viewer
│       └── components/
│           ├── PolicyCard.tsx
│           ├── ClaimStatus.tsx
│           ├── ReasoningTrail.tsx  Renders onchain chain-of-thought
│           └── AgentPipeline.tsx   Visual of two-agent chain
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
| Agent Orchestration | Somnia Base Agents (onchain — no backend) |
| LLM | Qwen3-360 via Somnia LLM Inference Agent |
| External Data | DeFiLlama API, AviationStack API (via JSON API Request Agent) |
| Frontend | React + ethers.js + TailwindCSS |
| Wallet | MetaMask (EVM-compatible) |

**Note:** There is no offchain backend. No TypeScript agent runner. No Lambda. No EC2. Everything runs onchain through Somnia's base agents and consensus validation. This is the architecture George Walker described as the solution to "both work, neither composes."

---

## Network Details

**Somnia Mainnet**
```
RPC URL:   https://api.infra.mainnet.somnia.network
Chain ID:  5031
Symbol:    SOMI
Explorer:  https://explorer.somnia.network
```

**Somnia Testnet (Shannon)**
```
RPC URL:   https://dream-rpc.somnia.network
Chain ID:  50312
Explorer:  https://shannon-explorer.somnia.network
```

---

## Getting Started

### Prerequisites
- Node.js v18+
- MetaMask with Somnia network added ([chainlist.org](https://chainlist.org) → search "Somnia")
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

```
SOMNIA_RPC_URL=https://api.infra.mainnet.somnia.network
SOMNIA_TESTNET_RPC_URL=https://dream-rpc.somnia.network
PRIVATE_KEY=your_deployer_wallet_private_key
AVIATIONSTACK_API_KEY=your_aviationstack_api_key
DEFILLAMA_API_URL=https://api.llama.fi
POLICY_BRAIN_ADDRESS=
INSURANCE_POOL_ADDRESS=
CLAIM_REGISTRY_ADDRESS=
```

### Deployed Contracts — Somnia Testnet (Shannon)

| Contract | Address |
|---|---|
| PolicyBrain | `0xaaaa68eE2cBbDf9Eb6492030A230a14e9cbC31c2` |
| ClaimRegistry | `0x7Bf8D0c64b28bFf00c3301BbDbe28372f5fF61B7` |
| InsurancePool | `0xC763184E3237DAb892d4bBc48C12C483B735525f` |
| ClaimBrain | `0x47D3b2a632C7fa2dB1F38D90C1177A960d18846a` |
| MonitoringContract | `0x3d343209aB055323B83D3E9307baB6dA78040922` |

Explorer: [shannon-explorer.somnia.network](https://shannon-explorer.somnia.network)

### Deploy Contracts (fresh deploy)

```bash
cd contracts
npm run deploy:testnet   # Somnia testnet
npm run deploy:mainnet   # Somnia mainnet
```

### Run the Frontend

```bash
cd frontend
cp .env.example .env     # fill in contract addresses + API keys
npm run dev
```

---

## How to Deploy a Policy Module

CLAIMBRAIN is a protocol. Anyone can deploy a policy module:

```solidity
// 1. Add rules to the Policy Brain
policyBrain.addRule(
    policyId,
    "tvl_drop_pct >= 80 AND exploit_confirmed == true",
    0,                // payoutAmount set per-policy
    "STANDARD",
    1                 // priority
);

// 2. Fund the insurance pool
insurancePool.fundPool{ value: poolCapital }(policyId);

// 3. Set the premium
insurancePool.setPremium(policyId, monthlyPremiumInUsdc);
```

Rules update without redeployment. The LLM agent queries them live as onchain tools.

---

## Judging Criteria

| Criterion | How CLAIMBRAIN Addresses It |
|---|---|
| **Functionality** | Two live policy modules (DeFi Hack + Flight Delay) deployed on Somnia. End-to-end claim flow tested with real data. Demo runs without manual steps. |
| **Agent-First Design** | Uses `inferToolsChat` with `onchainTools` — Somnia's most advanced agent method. LLM agent calls Policy Brain contract functions mid-reasoning. No offchain backend. Two base agents chained via callbacks. |
| **Innovation** | Policy Brain as open onchain infrastructure is novel. Multi-agent chain (JSON API → LLM with onchain tools) has not been built on Somnia. Full chain-of-thought reasoning trail permanently on chain. |
| **Autonomous Performance** | Agent monitors policies and triggers claims automatically. No human action required after policy purchase. Retry logic handles failed agent calls. Reasoning trail allows judges to audit every decision independently. |

---

## Roadmap

**Hackathon (3 weeks)**
- [ ] PolicyBrain.sol — open rule storage contract
- [ ] InsurancePool.sol — capital pool + payout execution
- [ ] ClaimBrain.sol — multi-agent chain orchestrator
- [ ] ClaimRegistry.sol — reasoning trail logger
- [ ] DeFi Hack module — DeFiLlama + LLM chain
- [ ] Flight Delay module — AviationStack + LLM chain
- [ ] React frontend with ReasoningTrail viewer
- [ ] Deployed on Somnia mainnet

**Post-Hackathon**
- [ ] Permissionless module deployment UI
- [ ] Governance for Policy Brain rule proposals
- [ ] Crop insurance module (satellite + IoT data)
- [ ] Gig worker income protection module
- [ ] Dynamic premium pricing agent (live risk assessment pre-purchase)

---

## Team

Built by **Daniel Akinsanya** ([@dannyy2000](https://github.com/dannyy2000)) for the Somnia Agentathon 2026.

---

## License

MIT
