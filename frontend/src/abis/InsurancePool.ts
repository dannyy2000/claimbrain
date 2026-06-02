export const INSURANCE_POOL_ABI = [
  // LP
  "function fundPool(uint256 policyId) payable",
  "function withdrawLP(uint256 policyId, uint256 sharesToBurn)",
  "function withdrawAllLP(uint256 policyId)",
  "function getLPShares(uint256 policyId, address lp) view returns (uint256 shares, uint256 totalShares, uint256 estimatedValue)",
  // Policy holders
  "function buyPolicy(uint256 policyId, uint256 coverageAmount) payable returns (uint256 policyTokenId)",
  "function getCoverageAmount(uint256 policyId, address holder) view returns (uint256)",
  "function isActive(uint256 policyId, address holder) view returns (bool)",
  "function getPurchasedAt(uint256 policyId, address holder) view returns (uint256)",
  // Config
  "function setPremium(uint256 policyId, uint256 monthlyPremium)",
  "function getPremium(uint256 policyId) view returns (uint256)",
  "function getPoolBalance(uint256 policyId) view returns (uint256)",
  // Events
  "event PoolFunded(uint256 indexed policyId, address indexed lp, uint256 amount, uint256 sharesIssued)",
  "event LPWithdrew(uint256 indexed policyId, address indexed lp, uint256 amount, uint256 sharesBurned)",
  "event PolicyPurchased(uint256 indexed policyId, address indexed holder, uint256 coverageAmount, uint256 premium)",
  "event PayoutExecuted(uint256 indexed policyId, address indexed claimant, uint256 amount)",
] as const;
