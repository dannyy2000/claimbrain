# CLAIMBRAIN — Architecture

## Overview

CLAIMBRAIN is fully onchain. There is no offchain backend, no TypeScript agent runner, no Lambda, no EC2. All intelligence runs through Somnia's base agents — validated by multiple validators through consensus.

```
USER / MONITORING CONTRACT
        ↓
ClaimBrain.sol  (orchestrator)
        ↓ createRequest()
Somnia Platform Contract  (0x5E520... mainnet / 0x037Bb... testnet)
        ↓
Base Agent 1: JSON API Request  (ID: 131742929741608977713)
        ↓ handleTVLData() callback
Base Agent 2: LLM Inference     (ID: 128472938475618029384)
        ↓ handleDecision() callback
InsurancePool.sol  (executes payout)
ClaimRegistry.sol  (logs reasoning trail)
```

---

## Contracts

### ClaimBrain.sol — Core Orchestrator

The central contract. Manages the two-agent chain for every claim.

```
Functions:
  initiateClaim(policyId, claimant, protocolOrFlight) external payable
  handleTVLData(requestId, responses, status, details) external   ← callback 1
  handleDecision(requestId, responses, status, details) external  ← callback 2

State:
  mapping(uint256 => ClaimContext) pendingClaims
  IAgentRequester platform
  IPolicyBrain policyBrain
  IInsurancePool insurancePool
  IClaimRegistry claimRegistry
```

### PolicyBrain.sol — Open Rule Infrastructure

Stores insurance rules as structured onchain data. Queryable as a live tool by the LLM agent mid-reasoning. Rules update without redeployment.

```
Functions:
  addRule(policyId, condition, payoutAmount, ruleType, priority)
  getRules(policyId) → Rule[]                  ← called by LLM as onchain tool
  getFraudHistory(claimant) → ClaimRecord[]    ← called by LLM as onchain tool
  getCustomerTier(claimant) → string           ← called by LLM as onchain tool
  deactivateRule(ruleId)
  getRulesCount(policyId) → uint256

Events:
  RuleAdded(policyId, ruleId, condition, ruleType)
  RuleDeactivated(ruleId)
```

### InsurancePool.sol — Capital + Payouts

Holds funds. Executes payouts when ClaimBrain instructs it. Isolated per policy — one pool's failure does not affect others.

```
Functions:
  fundPool(policyId) external payable
  buyPolicy(policyId, coverageAmount) external payable → policyTokenId
  executePayout(policyId, claimant, amount) external   ← called by ClaimBrain
  flagForReview(policyId, claimant) external
  setPremium(policyId, monthlyPremium)
  getPoolBalance(policyId) → uint256

Access: only ClaimBrain can call executePayout / flagForReview
```

### ClaimRegistry.sol — Permanent Log

Logs every claim decision with full chain-of-thought reasoning trail. Permanently readable by anyone.

```
Functions:
  logDecision(policyId, claimant, decision, reasoning, requestId)
  getClaim(claimId) → ClaimRecord
  getClaimsByPolicy(policyId) → ClaimRecord[]
  getClaimsByClaimant(claimant) → ClaimRecord[]

struct ClaimRecord {
    uint256 claimId;
    uint256 policyId;
    address claimant;
    string  decision;     // "APPROVE" | "REJECT" | "FLAG_FRAUD"
    string  reasoning;    // full chain-of-thought from LLM
    uint256 payoutAmount;
    uint256 requestId;    // Somnia agent request ID for verification
    uint256 timestamp;
}
```

---

## The Two-Agent Chain

Every claim goes through exactly two Somnia base agent calls, chained via callbacks.

### Step 1 — JSON API Request Agent

**Purpose:** Fetch live real-world data.

For DeFi Hack:
```solidity
bytes memory payload = abi.encodeWithSelector(
    IJsonApiAgent.fetchString.selector,
    "https://api.llama.fi/protocol/aave",
    "currentChainTvls.Ethereum"
);
platform.createRequest{value: deposit}(
    JSON_API_AGENT_ID,           // 131742929741608977713
    address(this),
    this.handleTVLData.selector,
    payload
);
```

For Flight Delay:
```solidity
bytes memory payload = abi.encodeWithSelector(
    IJsonApiAgent.fetchString.selector,
    "https://api.aviationstack.com/v1/flights?flight_iata=AA123&access_key=KEY",
    "data.0.departure.delay_reason"
);
```

### Step 2 — LLM Inference Agent (inferToolsChat)

**Purpose:** Reason over evidence + Policy Brain rules. Called from inside callback 1.

```solidity
// Register Policy Brain functions as live tools for the LLM
OnchainTool[] memory tools = new OnchainTool[](3);
tools[0] = OnchainTool({
    signature:   "getRules(uint256 policyId)",
    description: "Fetch all active insurance rules for this policy ID"
});
tools[1] = OnchainTool({
    signature:   "getFraudHistory(address claimant)",
    description: "Get full claim history for this wallet — fraud detection"
});
tools[2] = OnchainTool({
    signature:   "getCustomerTier(address claimant)",
    description: "Get customer tier (STANDARD / VIP) for payout multiplier"
});

// Conversation for the LLM
string[] memory roles    = new string[](2);
string[] memory messages = new string[](2);
roles[0]    = "system";
messages[0] = "You are an autonomous insurance claims agent on Somnia. "
              "Use the provided onchain tools to query policy rules, fraud history, "
              "and customer tier. Reason step by step. "
              "Return ONLY one of: APPROVE, REJECT, FLAG_FRAUD";
roles[1]    = "user";
messages[1] = string(abi.encodePacked(
    "Claim — Protocol: ", protocolName,
    ". Current TVL: ",    tvlData,
    ". Claimant: ",       claimantAddress,
    ". Policy ID: ",      policyIdStr,
    ". Use tools to query rules and fraud history, then decide."
));

bytes memory llmPayload = abi.encodeWithSelector(
    ILLMAgent.inferToolsChat.selector,
    roles,
    messages,
    new string[](0),   // no MCP servers
    tools,
    5,                 // max 5 tool-call iterations
    true               // chainOfThought = ON — audit trail
);

platform.createRequest{value: address(this).balance}(
    LLM_INFERENCE_AGENT_ID,      // 128472938475618029384
    address(this),
    this.handleDecision.selector,
    llmPayload
);
```

### Callback 2 — Execute Decision

```solidity
function handleDecision(
    uint256 requestId,
    Response[] memory responses,
    ResponseStatus status,
    Request memory
) external {
    require(msg.sender == address(platform), "Only platform");
    ClaimContext memory ctx = pendingClaims[requestId];
    string memory decision  = abi.decode(responses[0].result, (string));
    string memory reasoning = ""; // extracted from chainOfThought response

    if (keccak256(bytes(decision)) == keccak256(bytes("APPROVE"))) {
        uint256 payout = policyBrain.calculatePayout(ctx.policyId, ctx.claimant);
        insurancePool.executePayout(ctx.policyId, ctx.claimant, payout);
    } else if (keccak256(bytes(decision)) == keccak256(bytes("FLAG_FRAUD"))) {
        insurancePool.flagForReview(ctx.policyId, ctx.claimant);
    }

    claimRegistry.logDecision(
        ctx.policyId, ctx.claimant, decision, reasoning, requestId
    );
    delete pendingClaims[requestId];
}
```

---

## Context Preservation Between Callbacks

Because each callback fires asynchronously, claim context is stored in a mapping:

```solidity
struct ClaimContext {
    uint256 policyId;
    address claimant;
    string  protocolOrFlight;
    string  rawData;            // filled after Agent 1 callback
    uint256 stage;              // 1 = awaiting API, 2 = awaiting LLM
}

mapping(uint256 => ClaimContext) public pendingClaims;

// In handleTVLData — transfer context to new requestId
pendingClaims[llmRequestId] = pendingClaims[requestId];
pendingClaims[llmRequestId].rawData = tvlData;
pendingClaims[llmRequestId].stage   = 2;
delete pendingClaims[requestId];
```

---

## Deposit Management

Both agent calls require SOMI deposits. The contract must hold sufficient balance.

```solidity
// Query required deposit before calling
uint256 depositPerCall = platform.getRequestDeposit();

// Split deposit across two calls
// Unused deposit is returned to the contract via receive()
receive() external payable {}
```

Premium pricing is calculated to cover gas + agent deposits + capital reserve.

---

## Security Model

| Concern | Mitigation |
|---|---|
| Fake platform callback | `require(msg.sender == address(platform))` in every callback |
| Unknown requestId | `require(pendingClaims[requestId].policyId != 0)` check |
| Agent hallucination | `allowedValues = ["APPROVE","REJECT","FLAG_FRAUD"]` — constrained output |
| Pool drainage | Only ClaimBrain can call executePayout — access controlled |
| Pool isolation | Each policy has its own pool — one failure doesn't affect others |
| Fraud gaming | getFraudHistory checked on every claim by the LLM agent |
| Anti-gaming | holding_days rule prevents buying coverage after exploit |

---

## Data Sources

| Module | Agent | Data Source | Selector |
|---|---|---|---|
| DeFi Hack | JSON API Request | `api.llama.fi/protocol/{name}` | `currentChainTvls.Ethereum` |
| DeFi Hack | JSON API Request | `api.llama.fi/protocol/{name}` | `chainTvls.Ethereum.tvl[0].totalLiquidityUSD` |
| Flight Delay | JSON API Request | `api.aviationstack.com/v1/flights` | `data.0.departure.delay_reason` |
| Flight Delay | JSON API Request | `api.aviationstack.com/v1/flights` | `data.0.arrival.delay` |

---

## Frontend Key Components

**ReasoningTrail.tsx** — reads `ClaimRegistry.logDecision` events and renders the full chain-of-thought reasoning onchain. This is the most important UI component — it shows judges the agent's thinking, not just the outcome.

**AgentPipeline.tsx** — live visual showing which stage of the two-agent chain a claim is currently in (Agent 1 running / Agent 2 running / Complete).
