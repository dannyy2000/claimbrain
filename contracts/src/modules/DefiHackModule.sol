// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IPolicyBrain.sol";

contract DefiHackModule {
    uint256 public constant POLICY_ID = 1;

    IPolicyBrain public policyBrain;
    address      public owner;
    bool         public seeded;

    event RulesSeeded(uint256 indexed policyId, uint256 ruleCount);

    modifier onlyOwner() {
        require(msg.sender == owner, "DefiHackModule: not owner");
        _;
    }

    constructor(address _policyBrain) {
        policyBrain = IPolicyBrain(_policyBrain);
        owner       = msg.sender;
    }

    function seedRules() external onlyOwner {
        require(!seeded, "DefiHackModule: already seeded");
        seeded = true;

        // FRAUD_FLAG — evaluated first (highest priority)
        policyBrain.addRule(
            POLICY_ID,
            "claims_this_year >= 2",
            0,
            "FRAUD_FLAG",
            20
        );

        // EXCEPTIONS — override base rules
        policyBrain.addRule(
            POLICY_ID,
            "holding_days < 7",
            0,
            "EXCEPTION",
            10
        );

        policyBrain.addRule(
            POLICY_ID,
            "event_type == RUG_PULL",
            0,
            "EXCEPTION",
            10
        );

        // STANDARDS with speed bonus — higher priority than base
        policyBrain.addRule(
            POLICY_ID,
            "tvl_drop_pct >= 80 AND exploit_confirmed == true AND claim_initiated_within_24hrs == true",
            0,  // payout = coverage + 10% bonus, calculated at settlement
            "STANDARD",
            4
        );

        // Base STANDARD rules
        policyBrain.addRule(
            POLICY_ID,
            "tvl_drop_pct >= 80 AND exploit_confirmed == true",
            0,  // payout = full coverage amount
            "STANDARD",
            3
        );

        policyBrain.addRule(
            POLICY_ID,
            "tvl_drop_pct >= 50 AND tvl_drop_pct < 80 AND exploit_confirmed == true",
            0,  // payout = 60% of coverage amount
            "STANDARD",
            2
        );

        emit RulesSeeded(POLICY_ID, 6);
    }
}
