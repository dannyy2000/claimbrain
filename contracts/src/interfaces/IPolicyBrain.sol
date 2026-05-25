// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

struct Rule {
    uint256 ruleId;
    uint256 policyId;
    string  condition;
    uint256 payoutAmount;
    string  ruleType;
    uint256 priority;
    bool    active;
    uint256 createdAt;
    address createdBy;
}

struct ClaimRecord {
    uint256 claimId;
    uint256 policyId;
    address claimant;
    string  decision;
    string  reasoning;
    uint256 payoutAmount;
    uint256 requestId;
    uint256 timestamp;
}

interface IPolicyBrain {
    function addRule(
        uint256 policyId,
        string  calldata condition,
        uint256 payoutAmount,
        string  calldata ruleType,
        uint256 priority
    ) external returns (uint256 ruleId);

    function getRules(uint256 policyId) external view returns (Rule[] memory);

    function getFraudHistory(address claimant) external view returns (uint256 claimsThisYear, bool hasFraudFlag);

    function getCustomerTier(address claimant) external view returns (string memory tier);

    function recordClaim(uint256 policyId, address claimant, string calldata decision) external;

    function setCustomerTier(address claimant, string calldata tier) external;

    function deactivateRule(uint256 ruleId) external;

    function getRulesCount(uint256 policyId) external view returns (uint256);
}
