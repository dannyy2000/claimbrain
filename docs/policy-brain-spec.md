# Policy Brain Specification

## What Is the Policy Brain?

The Policy Brain is a standalone smart contract that stores insurance rules as structured, queryable, onchain knowledge. It is the core differentiator of CLAIMBRAIN.

**What every other project does:**
Rules are hardcoded into the contract. `if (tvl_drop > 80%) { pay(); }`. When rules change, they redeploy. When edge cases arise, they break.

**What CLAIMBRAIN does:**
Rules are stored as data in the Policy Brain. The LLM Inference agent is given the Policy Brain's functions as `onchainTools`. The agent calls `getRules(policyId)`, `getFraudHistory(address)`, and `getCustomerTier(address)` mid-reasoning — getting live onchain data each time. Rules update without redeployment. The agent handles complexity a hardcoded contract never could.

---

## Rule Data Structure

```solidity
struct Rule {
    uint256 ruleId;
    uint256 policyId;
    string  condition;      // human-readable: "tvl_drop_pct >= 80 AND exploit_confirmed"
    uint256 payoutAmount;   // USDC, 6 decimals. 0 = calculated per-policy
    string  ruleType;       // STANDARD | EXCEPTION | FRAUD_FLAG | MULTIPLIER
    uint256 priority;       // higher number = evaluated first by LLM
    bool    active;
    uint256 createdAt;
    address createdBy;
}
```

---

## Rule Types

| Type | What It Does | Example |
|---|---|---|
| `STANDARD` | Base payout trigger | TVL drops 80% = full coverage |
| `EXCEPTION` | Overrides or blocks a standard rule | Rug pull = excluded |
| `FRAUD_FLAG` | Flags claim for review instead of paying | 2+ claims this year |
| `MULTIPLIER` | Adjusts final payout amount | VIP tier = 1.5x |

Rules with higher priority numbers are passed to the LLM first. The agent reasons over them in priority order.

---

## DeFi Hack Module — Full Rule Set

```
Rule 1  STANDARD   (priority 3):
  "tvl_drop_pct >= 80 AND exploit_confirmed == true"
  → Full coverage payout

Rule 2  STANDARD   (priority 2):
  "tvl_drop_pct >= 50 AND tvl_drop_pct < 80 AND exploit_confirmed == true"
  → 60% coverage payout

Rule 3  EXCEPTION  (priority 10):
  "holding_days < 7"
  → REJECT — anti-gaming rule. Must hold before exploit to claim.

Rule 4  EXCEPTION  (priority 10):
  "event_type == RUG_PULL"
  → REJECT — rug pulls excluded from coverage

Rule 5  FRAUD_FLAG (priority 20):
  "claims_this_year >= 2"
  → FLAG_FRAUD — escalate for manual review

Rule 6  STANDARD   (priority 4):
  "tvl_drop_pct >= 80 AND claim_initiated_within_24hrs == true"
  → Full coverage + 10% speed resolution bonus
```

---

## Flight Delay Module — Full Rule Set

```
Rule 1  STANDARD   (priority 1):
  "delay_hours >= 2 AND cause != WEATHER"
  → $100 payout

Rule 2  STANDARD   (priority 2):
  "delay_hours >= 4 AND cause != WEATHER"
  → $200 payout

Rule 3  STANDARD   (priority 3):
  "delay_hours >= 8 AND cause != WEATHER"
  → $400 payout

Rule 4  EXCEPTION  (priority 10):
  "cause == WEATHER"
  → REJECT — weather delays excluded

Rule 5  EXCEPTION  (priority 15):
  "cause == WEATHER AND season == HOLIDAY AND storm_category >= 3"
  → Override Rule 4 — holiday + major storm = covered

Rule 6  FRAUD_FLAG (priority 20):
  "claims_this_year >= 3"
  → FLAG_FRAUD

Rule 7  MULTIPLIER (priority 5):
  "customer_tier == VIP"
  → 1.5x final payout
```

---

## How the LLM Agent Uses the Policy Brain as a Tool

This is the key technical differentiator. Instead of passing rules as a string, the Policy Brain's functions are registered as `onchainTools` for the `inferToolsChat` agent method.

```solidity
// In ClaimBrain.sol — called from inside the JSON API callback
OnchainTool[] memory tools = new OnchainTool[](3);

tools[0] = OnchainTool({
    signature:   "getRules(uint256 policyId)",
    description: "Fetch all active insurance rules for a given policy ID. "
                 "Returns an array of Rule structs with conditions and payout amounts."
});

tools[1] = OnchainTool({
    signature:   "getFraudHistory(address claimant)",
    description: "Get the claim history for a wallet address. "
                 "Returns count of claims this year and any existing fraud flags."
});

tools[2] = OnchainTool({
    signature:   "getCustomerTier(address claimant)",
    description: "Returns STANDARD or VIP tier for this wallet. "
                 "VIP customers receive a 1.5x payout multiplier."
});
```

The LLM agent then:
1. Receives the claim context (TVL data, claimant address, policy ID)
2. Decides it needs the policy rules — calls `getRules(policyId)`
3. Decides it needs fraud history — calls `getFraudHistory(claimant)`
4. Decides it needs customer tier — calls `getCustomerTier(claimant)`
5. Reasons over all returned data with chain-of-thought
6. Returns `"APPROVE"`, `"REJECT"`, or `"FLAG_FRAUD"`

The agent is not reading a static context. It is actively querying live onchain state.

---

## What chainOfThought: true Produces

With `chainOfThought: true`, the LLM's full reasoning is returned alongside the decision. This is logged in `ClaimRegistry.sol` and displayed in the frontend's `ReasoningTrail` component.

Example reasoning trail stored onchain:

```
Step 1: I need to understand what rules apply to this policy.
        Calling getRules(42) →
        [Rule 1: tvl_drop >= 80% AND exploit_confirmed = full coverage]
        [Rule 3: holding_days < 7 = REJECT]
        [Rule 5: claims_this_year >= 2 = FLAG_FRAUD]

Step 2: Checking fraud history for this claimant.
        Calling getFraudHistory(0xABC...) →
        [claims_this_year: 0, no existing fraud flag]
        Fraud check passed.

Step 3: Checking customer tier.
        Calling getCustomerTier(0xABC...) →
        [tier: STANDARD]
        No multiplier applied.

Step 4: Evaluating evidence.
        TVL drop: 83% — exceeds 80% threshold in Rule 1.
        exploit_confirmed: true (DeFiLlama confirms).
        holding_days: 45 — exceeds 7-day minimum in Rule 3.
        Rule 3 exception does NOT apply.
        Rule 1 DOES apply.

Decision: APPROVE — full coverage payout.
```

This is permanently on Somnia. Any judge, regulator, or user can verify why the claim was settled.

---

## Adding Rules Without Redeployment

```solidity
// Policy maker adds a new rule to an existing policy
policyBrain.addRule(
    policyId,
    "tvl_drop_pct >= 95 AND exploit_confirmed == true",
    0,            // payout calculated from coverage amount
    "STANDARD",
    5             // priority
);
```

The next claim processed by the LLM agent will include this rule automatically — no contract redeployment, no system downtime.

---

## Protocol Openness

The Policy Brain is a permissionless contract. Any team can deploy a policy module using it:

```
1. Call addRule() to define coverage terms
2. Call insurancePool.fundPool() to capitalise the pool
3. Call insurancePool.setPremium() to set monthly cost
4. The ClaimBrain agent chain handles all claims automatically
```

CLAIMBRAIN ships with two modules. The protocol supports unlimited modules.
