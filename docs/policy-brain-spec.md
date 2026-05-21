# Policy Brain Specification

## What Is the Policy Brain?

The Policy Brain is a smart contract that stores insurance rules as structured, queryable, onchain knowledge. It is the intelligence layer that separates CLAIMBRAIN from simple parametric insurance contracts.

## Rule Structure

Each rule has the following fields:

```solidity
struct Rule {
    uint256 ruleId;
    uint256 policyId;
    string condition;       // human-readable condition string
    uint256 payoutAmount;   // in USDC (6 decimals)
    string ruleType;        // STANDARD | EXCEPTION | FRAUD_FLAG | MULTIPLIER
    uint256 priority;       // higher priority rules evaluated first
    bool active;
    uint256 createdAt;
    address createdBy;
}
```

## Rule Types

| Type | Description | Example |
|---|---|---|
| STANDARD | Base payout rule | delay > 3hrs → $200 |
| EXCEPTION | Overrides standard rules | weather exclusion |
| FRAUD_FLAG | Blocks or flags claim | >3 claims/year |
| MULTIPLIER | Adjusts payout amount | VIP = 1.5x |

## Flight Delay Policy Rules (Initial Set)

```
Rule 1 (STANDARD,  priority 1): delay_hours >= 2 AND cause != WEATHER  → $100
Rule 2 (STANDARD,  priority 2): delay_hours >= 4 AND cause != WEATHER  → $200
Rule 3 (STANDARD,  priority 3): delay_hours >= 8 AND cause != WEATHER  → $400
Rule 4 (EXCEPTION, priority 10): cause == WEATHER                      → $0 (excluded)
Rule 5 (FRAUD_FLAG,priority 20): claims_this_year >= 3                 → FLAG
Rule 6 (MULTIPLIER,priority 5):  customer_tier == VIP                  → 1.5x payout
Rule 7 (EXCEPTION, priority 15): season == HOLIDAY AND storm_cat >= 3  → override Rule 4
```

## DeFi Hack Policy Rules (Initial Set)

```
Rule 1 (STANDARD,  priority 1): tvl_drop_pct >= 50 AND exploit_confirmed == true → cover_amount
Rule 2 (EXCEPTION, priority 10): holding_days < 7                                → $0 (anti-gaming)
Rule 3 (EXCEPTION, priority 10): event_type == RUG_PULL                          → $0 (excluded)
Rule 4 (FRAUD_FLAG,priority 20): claims_this_year >= 2                           → FLAG
Rule 5 (STANDARD,  priority 2): tvl_drop_pct >= 80 AND exploit_confirmed == true → cover_amount * 1.1 (fast settlement bonus)
```

## How the Agent Queries the Brain

```typescript
// Agent queries all rules for a policy
const rules = await policyBrain.getRules(policyId);

// Agent evaluates rules against claim data
const decision = evaluateRules(rules, {
  delay_hours: 5,
  cause: "MECHANICAL",
  claims_this_year: 1,
  customer_tier: "VIP"
});

// Decision includes: payoutAmount, rulesApplied[], evidence
```

## Adding New Rules

Policy makers can add rules without redeploying the contract:

```solidity
policyBrain.addRule(
    policyId,
    "delay_hours >= 6 AND cause != WEATHER",
    300,
    "STANDARD",
    3  // priority
);
```

All rule additions are logged as onchain events — full audit history.
