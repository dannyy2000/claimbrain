import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

const ADDRESSES = {
  policyBrain:   process.env.POLICY_BRAIN_ADDRESS!,
  claimRegistry: process.env.CLAIM_REGISTRY_ADDRESS!,
  insurancePool: process.env.INSURANCE_POOL_ADDRESS!,
  claimBrain:    process.env.CLAIM_BRAIN_ADDRESS!,
  monitoring:    process.env.MONITORING_CONTRACT_ADDRESS!,
};

const INSURANCE_POOL_ABI = [
  "function buyPolicy(uint256 policyId, uint256 coverageAmount) payable returns (uint256)",
  "function getPremium(uint256 policyId) view returns (uint256)",
  "function isActive(uint256 policyId, address holder) view returns (bool)",
  "function getPoolBalance(uint256 policyId) view returns (uint256)",
];

const CLAIM_BRAIN_ABI = [
  "function initiateClaim(uint256 policyId, address claimant, string protocolOrFlight, string apiUrl, string apiSelector) payable",
  "function pendingClaims(uint256 requestId) view returns (uint256,address,string,string,uint8)",
  "event ClaimInitiated(uint256 indexed policyId, address indexed claimant, uint256 requestId)",
  "event ApiDataReceived(uint256 indexed requestId, string data)",
  "event DecisionReceived(uint256 indexed requestId, string decision)",
  "event PayoutTriggered(uint256 indexed policyId, address indexed claimant, uint256 amount)",
  "event ClaimRejected(uint256 indexed policyId, address indexed claimant)",
  "event FraudFlagged(uint256 indexed policyId, address indexed claimant)",
];

const CLAIM_REGISTRY_ABI = [
  "function totalClaims() view returns (uint256)",
  "function getClaim(uint256 claimId) view returns (tuple(uint256 claimId, uint256 policyId, address claimant, string decision, string reasoning, uint256 payoutAmount, uint256 requestId, uint256 timestamp))",
];

const PLATFORM_ABI = [
  "function getRequestDeposit() view returns (uint256)",
];

const PLATFORM_ADDRESS = "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776";

async function main() {
  const [deployer] = await ethers.getSigners();
  const provider   = deployer.provider!;

  console.log("=".repeat(60));
  console.log("CLAIMBRAIN — End-to-End Claim Test");
  console.log("=".repeat(60));
  console.log(`Wallet:  ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await provider.getBalance(deployer.address))} SOMI\n`);

  const pool     = new ethers.Contract(ADDRESSES.insurancePool, INSURANCE_POOL_ABI, deployer);
  const brain    = new ethers.Contract(ADDRESSES.claimBrain,    CLAIM_BRAIN_ABI,    deployer);
  const registry = new ethers.Contract(ADDRESSES.claimRegistry, CLAIM_REGISTRY_ABI, deployer);
  const platform = new ethers.Contract(PLATFORM_ADDRESS,        PLATFORM_ABI,       deployer);

  // ── Step 1: Check pool state ───────────────────────────────────────────────
  console.log("[ 1 ] Checking pool state...");
  const poolBalance = await pool.getPoolBalance(1n);
  const premium     = await pool.getPremium(1n);
  console.log(`      Pool balance: ${ethers.formatEther(poolBalance)} SOMI`);
  console.log(`      Premium:      ${ethers.formatEther(premium)} SOMI`);

  // ── Step 2: Check if we already have an active policy ─────────────────────
  console.log("\n[ 2 ] Checking policy status...");
  const alreadyActive = await pool.isActive(1n, deployer.address);
  if (!alreadyActive) {
    console.log("      No active policy — buying one...");
    const buyTx = await pool.buyPolicy(1n, ethers.parseEther("1"), { value: premium });
    await buyTx.wait();
    console.log(`      Policy purchased: ${buyTx.hash}`);
  } else {
    console.log("      Active policy found.");
  }

  // ── Step 3: Get required deposit from platform ─────────────────────────────
  console.log("\n[ 3 ] Checking agent deposit requirement...");
  let depositPerCall: bigint;
  try {
    depositPerCall = await platform.getRequestDeposit();
    console.log(`      Deposit per call: ${ethers.formatEther(depositPerCall)} SOMI`);
  } catch {
    // Fallback if getRequestDeposit not available
    depositPerCall = ethers.parseEther("0.1");
    console.log(`      Could not read deposit — using fallback: ${ethers.formatEther(depositPerCall)} SOMI`);
  }

  // LLM costs more — send floor × 16 total so LLM gets plenty after JSON API call
  const totalDeposit = depositPerCall * 32n; // floor*4 API + floor*12 LLM1 + floor*12 reserve for tool loop

  // ── Step 4: Initiate claim ─────────────────────────────────────────────────
  console.log("\n[ 4 ] Initiating claim (fires JSON API agent)...");
  // Beanstalk was hacked April 2022 — currentChainTvls.Ethereum = 0
  // This should trigger APPROVE since TVL dropped 100%
  // Rich context passed as protocolOrFlight — ClaimBrain embeds it verbatim in the LLM message
  const claimEvent = "beanstalk DeFi hack | tvl_drop_pct=100 | exploit_confirmed=true | event_type=EXPLOIT | Beanstalk exploited April 2022 via flash loan governance attack, TVL dropped from $182M to $0";
  console.log(`      Protocol: beanstalk`);
  console.log(`      API URL:  https://api.llama.fi/protocol/beanstalk`);
  console.log(`      Selector: currentChainTvls.Ethereum`);
  console.log(`      Deposit:  ${ethers.formatEther(totalDeposit)} SOMI`);

  const claimTx = await brain.initiateClaim(
    1n,
    deployer.address,
    claimEvent,
    "https://api.llama.fi/protocol/beanstalk",
    "currentChainTvls.Ethereum",
    { value: totalDeposit }
  );

  console.log(`      Tx sent: ${claimTx.hash}`);
  const receipt = await claimTx.wait();
  console.log(`      Confirmed in block ${receipt.blockNumber}`);

  // Parse ClaimInitiated event
  const initiatedEvent = receipt.logs
    .map((log: { topics: string[]; data: string }) => {
      try { return brain.interface.parseLog(log); } catch { return null; }
    })
    .find((e: { name: string } | null) => e?.name === "ClaimInitiated");

  if (initiatedEvent) {
    console.log(`      Request ID: ${initiatedEvent.args.requestId}`);
  }

  // ── Step 5: Poll for result (Somnia RPC lacks `removed` field — events crash ethers v6)
  console.log("\n[ 5 ] Waiting for agent callbacks (polling every 10s, max 8 min)...");
  console.log("      Agent 1 (JSON API) → Agent 2 (LLM Inference) → callback\n");

  const claimsBefore = await registry.totalClaims();
  let settled = false;
  const POLL_INTERVAL = 10_000;
  const MAX_POLLS     = 48; // 8 minutes

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise(r => setTimeout(r, POLL_INTERVAL));

    // Check if request has been cleared from pendingClaims (stage→0 means done)
    const pending = await brain.pendingClaims(initiatedEvent?.args?.requestId ?? 0n);
    const stage   = pending[4]; // uint8 stage

    if (i % 3 === 0) {
      process.stdout.write(`      [${(i + 1) * 10}s] stage=${stage} `);
    }

    const claimsAfter = await registry.totalClaims();
    if (claimsAfter > claimsBefore) {
      settled = true;
      const claim = await registry.getClaim(claimsAfter);
      console.log(`\n\n${"=".repeat(60)}`);
      console.log("CLAIMBRAIN — SETTLED");
      console.log("=".repeat(60));
      console.log(`DECISION:  ${claim[3]}`);
      console.log(`PAYOUT:    ${ethers.formatEther(claim[5])} SOMI`);
      console.log(`REQUEST:   ${claim[6]}`);
      console.log("\nREASONING TRAIL (stored onchain):");
      console.log(claim[4] || "(no chain-of-thought)");
      console.log("=".repeat(60));
      break;
    }

    if (i === MAX_POLLS - 1) {
      console.log("\n\n      Timeout — callbacks still pending. Run check-new.ts to poll.");
    }
  }

  if (!settled) {
    console.log("\nTip: run  npx hardhat run scripts/check-new.ts --network somnia-testnet");
  }
}

main().catch(err => {
  console.error("Test failed:", err.message);
  process.exit(1);
});
