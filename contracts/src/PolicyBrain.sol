// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IPolicyBrain.sol";

contract PolicyBrain is IPolicyBrain {
    address public owner;

    uint256 private _ruleCounter;

    // policyId => list of ruleIds
    mapping(uint256 => uint256[]) private _policyRules;
    // ruleId => Rule
    mapping(uint256 => Rule) private _rules;

    // claimant => claims this calendar year
    mapping(address => uint256) private _claimsThisYear;
    // claimant => fraud flag
    mapping(address => bool) private _fraudFlags;
    // claimant => tier ("STANDARD" | "VIP")
    mapping(address => string) private _customerTiers;

    // contracts authorised to record claims and set tiers (i.e. ClaimBrain)
    mapping(address => bool) public authorised;

    event RuleAdded(uint256 indexed policyId, uint256 indexed ruleId, string condition, string ruleType);
    event RuleDeactivated(uint256 indexed ruleId);
    event ClaimRecorded(uint256 indexed policyId, address indexed claimant, string decision);
    event TierSet(address indexed claimant, string tier);
    event AuthorisedSet(address indexed caller, bool status);

    modifier onlyOwner() {
        require(msg.sender == owner, "PolicyBrain: not owner");
        _;
    }

    modifier onlyAuthorised() {
        require(authorised[msg.sender] || msg.sender == owner, "PolicyBrain: not authorised");
        _;
    }

    constructor() {
        owner = msg.sender;
        authorised[msg.sender] = true;
    }

    function setAuthorised(address caller, bool status) external onlyOwner {
        authorised[caller] = status;
        emit AuthorisedSet(caller, status);
    }

    // --- Rule management ---

    function addRule(
        uint256 policyId,
        string  calldata condition,
        uint256 payoutAmount,
        string  calldata ruleType,
        uint256 priority
    ) external onlyAuthorised returns (uint256 ruleId) {
        _ruleCounter++;
        ruleId = _ruleCounter;

        _rules[ruleId] = Rule({
            ruleId:       ruleId,
            policyId:     policyId,
            condition:    condition,
            payoutAmount: payoutAmount,
            ruleType:     ruleType,
            priority:     priority,
            active:       true,
            createdAt:    block.timestamp,
            createdBy:    msg.sender
        });

        _policyRules[policyId].push(ruleId);
        emit RuleAdded(policyId, ruleId, condition, ruleType);
    }

    function deactivateRule(uint256 ruleId) external onlyAuthorised {
        require(_rules[ruleId].ruleId != 0, "PolicyBrain: rule not found");
        _rules[ruleId].active = false;
        emit RuleDeactivated(ruleId);
    }

    // --- LLM onchain tools (called by the agent mid-reasoning) ---

    function getRules(uint256 policyId) external view returns (Rule[] memory) {
        uint256[] storage ids = _policyRules[policyId];
        uint256 activeCount;
        for (uint256 i = 0; i < ids.length; i++) {
            if (_rules[ids[i]].active) activeCount++;
        }

        Rule[] memory active = new Rule[](activeCount);
        uint256 idx;
        for (uint256 i = 0; i < ids.length; i++) {
            if (_rules[ids[i]].active) active[idx++] = _rules[ids[i]];
        }
        return active;
    }

    function getFraudHistory(address claimant) external view returns (uint256 claimsThisYear, bool hasFraudFlag) {
        return (_claimsThisYear[claimant], _fraudFlags[claimant]);
    }

    function getCustomerTier(address claimant) external view returns (string memory tier) {
        string memory stored = _customerTiers[claimant];
        if (bytes(stored).length == 0) return "STANDARD";
        return stored;
    }

    // --- Called by ClaimBrain after each settled claim ---

    function recordClaim(uint256 policyId, address claimant, string calldata decision) external onlyAuthorised {
        _claimsThisYear[claimant]++;
        if (keccak256(bytes(decision)) == keccak256(bytes("FLAG_FRAUD"))) {
            _fraudFlags[claimant] = true;
        }
        emit ClaimRecorded(policyId, claimant, decision);
    }

    function setCustomerTier(address claimant, string calldata tier) external onlyAuthorised {
        _customerTiers[claimant] = tier;
        emit TierSet(claimant, tier);
    }

    // Admin reset for testing — clears claim count and fraud flag for an address
    function resetClaimant(address claimant) external onlyOwner {
        _claimsThisYear[claimant] = 0;
        _fraudFlags[claimant]     = false;
    }

    // --- Views ---

    function getRulesCount(uint256 policyId) external view returns (uint256) {
        return _policyRules[policyId].length;
    }

    function getRule(uint256 ruleId) external view returns (Rule memory) {
        return _rules[ruleId];
    }
}
