export const CLAIM_REGISTRY_ABI = [
  "function getClaim(uint256 claimId) view returns (tuple(uint256 claimId, uint256 policyId, address claimant, string decision, string reasoning, uint256 payoutAmount, uint256 requestId, uint256 timestamp))",
  "function getClaimsByPolicy(uint256 policyId) view returns (tuple(uint256 claimId, uint256 policyId, address claimant, string decision, string reasoning, uint256 payoutAmount, uint256 requestId, uint256 timestamp)[])",
  "function getClaimsByClaimant(address claimant) view returns (tuple(uint256 claimId, uint256 policyId, address claimant, string decision, string reasoning, uint256 payoutAmount, uint256 requestId, uint256 timestamp)[])",
  "function totalClaims() view returns (uint256)",
  "event DecisionLogged(uint256 indexed claimId, uint256 indexed policyId, address indexed claimant, string decision, uint256 payoutAmount, uint256 requestId)",
] as const;
