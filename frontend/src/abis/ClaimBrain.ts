export const CLAIM_BRAIN_ABI = [
  "function initiateClaim(uint256 policyId, address claimant, string protocolOrFlight, string apiUrl, string apiSelector) payable",
  "function pendingClaims(uint256 requestId) view returns (uint256 policyId, address claimant, string protocolOrFlight, string rawApiData, uint8 stage)",
  "event ClaimInitiated(uint256 indexed policyId, address indexed claimant, uint256 requestId)",
  "event ApiDataReceived(uint256 indexed requestId, string data)",
  "event DecisionReceived(uint256 indexed requestId, string decision)",
  "event PayoutTriggered(uint256 indexed policyId, address indexed claimant, uint256 amount)",
  "event ClaimRejected(uint256 indexed policyId, address indexed claimant)",
  "event FraudFlagged(uint256 indexed policyId, address indexed claimant)",
] as const;
