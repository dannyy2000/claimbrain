// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IInsurancePool {
    function fundPool(uint256 policyId) external payable;

    function buyPolicy(uint256 policyId, uint256 coverageAmount) external payable returns (uint256 policyTokenId);

    function executePayout(uint256 policyId, address claimant, uint256 amount) external;

    function flagForReview(uint256 policyId, address claimant) external;

    function setPremium(uint256 policyId, uint256 monthlyPremium) external;

    function getPoolBalance(uint256 policyId) external view returns (uint256);

    function getCoverageAmount(uint256 policyId, address holder) external view returns (uint256);
}
