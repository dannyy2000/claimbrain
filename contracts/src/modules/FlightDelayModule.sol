// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../interfaces/IPolicyBrain.sol";

contract FlightDelayModule {
    uint256 public constant POLICY_ID = 2;

    IPolicyBrain public policyBrain;
    address      public owner;
    bool         public seeded;

    event RulesSeeded(uint256 indexed policyId, uint256 ruleCount);

    modifier onlyOwner() {
        require(msg.sender == owner, "FlightDelayModule: not owner");
        _;
    }

    constructor(address _policyBrain) {
        policyBrain = IPolicyBrain(_policyBrain);
        owner       = msg.sender;
    }

    function seedRules() external onlyOwner {
        require(!seeded, "FlightDelayModule: already seeded");
        seeded = true;

        // FRAUD_FLAG — highest priority
        policyBrain.addRule(
            POLICY_ID,
            "claims_this_year >= 3",
            0,
            "FRAUD_FLAG",
            20
        );

        // EXCEPTION override — holiday + major storm overrides weather exclusion
        policyBrain.addRule(
            POLICY_ID,
            "cause == WEATHER AND season == HOLIDAY AND storm_category >= 3",
            0,
            "EXCEPTION",
            15
        );

        // EXCEPTION — weather delays excluded by default
        policyBrain.addRule(
            POLICY_ID,
            "cause == WEATHER",
            0,
            "EXCEPTION",
            10
        );

        // MULTIPLIER — VIP customers
        policyBrain.addRule(
            POLICY_ID,
            "customer_tier == VIP",
            0,  // signals 1.5x multiplier to LLM
            "MULTIPLIER",
            5
        );

        // STANDARD payout tiers (in wei, priced at deployment time)
        policyBrain.addRule(
            POLICY_ID,
            "delay_hours >= 8 AND cause != WEATHER",
            400 ether / 1000,   // $400 equivalent — adjust to SOMI at deploy
            "STANDARD",
            3
        );

        policyBrain.addRule(
            POLICY_ID,
            "delay_hours >= 4 AND cause != WEATHER",
            200 ether / 1000,   // $200 equivalent
            "STANDARD",
            2
        );

        policyBrain.addRule(
            POLICY_ID,
            "delay_hours >= 2 AND cause != WEATHER",
            100 ether / 1000,   // $100 equivalent
            "STANDARD",
            1
        );

        emit RulesSeeded(POLICY_ID, 7);
    }
}
