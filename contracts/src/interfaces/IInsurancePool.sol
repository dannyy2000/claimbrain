// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IInsurancePool {
    // --- Liquidity providers ---
    function fundPool(uint256 policyId) external payable;
    function withdrawLP(uint256 policyId, uint256 sharesToBurn) external;
    function withdrawAllLP(uint256 policyId) external;
    function getLPShares(uint256 policyId, address lp) external view returns (uint256 shares, uint256 totalShares, uint256 estimatedValue);

    // --- Policy holders ---
    function buyPolicy(uint256 policyId, uint256 coverageAmount) external payable returns (uint256 policyTokenId);
    function getCoverageAmount(uint256 policyId, address holder) external view returns (uint256);
    function isActive(uint256 policyId, address holder) external view returns (bool);
    function getPurchasedAt(uint256 policyId, address holder) external view returns (uint256);

    // --- ClaimBrain only ---
    function executePayout(uint256 policyId, address claimant, uint256 amount) external;
    function flagForReview(uint256 policyId, address claimant) external;

    // --- Configuration ---
    function setPremium(uint256 policyId, uint256 monthlyPremium) external;
    function getPremium(uint256 policyId) external view returns (uint256);
    function getPoolBalance(uint256 policyId) external view returns (uint256);
}
