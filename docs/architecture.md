# CLAIMBRAIN — Architecture

## System Overview

CLAIMBRAIN has three layers:

1. **Policy Brain** — onchain knowledge layer (Solidity)
2. **AI Agent** — autonomous reasoning layer (TypeScript)
3. **Insurance Pool** — execution layer (Solidity)

## Contract Interaction Flow

```
PolicyBrain.sol
  - addRule(policyId, condition, payoutAmount, ruleType)
  - getRules(policyId) → Rule[]
  - evaluateClaim(policyId, claimData) → Decision

InsurancePool.sol
  - fundPool(policyId)
  - buyPolicy(policyId, flightNumber, walletAddress)
  - executePayout(claimId, decision) → triggered by agent callback

ClaimRegistry.sol
  - logClaim(policyId, claimData, decision, evidence)
  - getClaim(claimId) → ClaimRecord
```

## Agent Monitoring Loop

```
Every 5 minutes:
  1. Read all active policies from InsurancePool
  2. For each policy:
     a. Determine policy type (FLIGHT | DEFI_HACK)
     b. Query relevant data source
     c. Check if trigger condition is met
     d. If triggered → initiate claim
  3. For each triggered claim:
     a. Query Policy Brain for applicable rules
     b. Apply rules + handle exceptions
     c. Generate decision + evidence package
     d. Submit to InsurancePool via Somnia Agent callback
```

## Somnia Agent Integration

CLAIMBRAIN uses Somnia's native agent invocation from Solidity:

```solidity
// InsurancePool.sol calls the agent
agentCoordinator.createRequest(
    CLAIMBRAIN_AGENT_ID,
    abi.encode(claimData),
    deposit
);

// Agent response comes back via callback
function agentCallback(
    bytes32 requestId,
    bytes calldata response
) external onlyAgentCoordinator {
    Decision memory decision = abi.decode(response, (Decision));
    _executePayout(decision);
}
```

## Data Sources

| Policy Type | Primary Source | Fallback |
|---|---|---|
| Flight Delay | AviationStack API | FlightAware API |
| DeFi Hack | DeFiLlama API | Onchain TVL check |

## Security Model

- Agent decisions are validated by multiple Somnia validators (consensus)
- No single point of failure — if one validator gives wrong result, consensus rejects it
- All rules are public — no hidden logic
- Insurance pools are isolated per policy — one pool failure doesn't affect others
- Private keys never leave the agent's secure environment
