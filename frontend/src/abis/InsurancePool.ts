export const INSURANCE_POOL_ABI = [
  "function buyPolicy(uint256 policyId, uint256 coverageAmount) payable returns (uint256 policyTokenId)",
  "function fundPool(uint256 policyId) payable",
  "function executePayout(uint256 policyId, address claimant, uint256 amount)",
  "function setPremium(uint256 policyId, uint256 monthlyPremium)",
  "function getPoolBalance(uint256 policyId) view returns (uint256)",
  "function getCoverageAmount(uint256 policyId, address holder) view returns (uint256)",
  "function getPremium(uint256 policyId) view returns (uint256)",
  "function isActive(uint256 policyId, address holder) view returns (bool)",
  "function getPurchasedAt(uint256 policyId, address holder) view returns (uint256)",
  "event PolicyPurchased(uint256 indexed policyId, address indexed holder, uint256 coverageAmount, uint256 premium)",
  "event PayoutExecuted(uint256 indexed policyId, address indexed claimant, uint256 amount)",
] as const;
