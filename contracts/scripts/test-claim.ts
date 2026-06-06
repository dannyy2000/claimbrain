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

  // Formula: floor + (floor × subcommittee_size) per call, default subcommittee = 3
  // So each call needs floor × 4. Two calls = floor × 8. Add buffer → floor × 10.
  const perCall      = depositPerCall * 4n;
  const totalDeposit = perCall * 2n + depositPerCall; // 2 calls + buffer

  // ── Step 4: Initiate claim ─────────────────────────────────────────────────
  console.log("\n[ 4 ] Initiating claim (fires JSON API agent)...");
  console.log(`      Protocol: aave`);
  console.log(`      API URL:  https://api.llama.fi/protocol/aave`);
  console.log(`      Selector: currentChainTvls.Ethereum`);
  console.log(`      Deposit:  ${ethers.formatEther(totalDeposit)} SOMI`);

  const claimTx = await brain.initiateClaim(
    1n,
    deployer.address,
    "aave",
    "https://api.llama.fi/protocol/aave",
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

  // ── Step 5: Watch for callbacks ───────────────────────────────────────────
  console.log("\n[ 5 ] Waiting for agent callbacks...");
  console.log("      Agent 1 (JSON API) processing...");
  console.log("      This may take 1-3 minutes on testnet.\n");

  const claimsBefore = await registry.totalClaims();

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      console.log("\n      Timeout reached — callbacks may still be processing.");
      console.log("      Check Agent Log on the frontend for results.");
      resolve();
    }, 5 * 60 * 1000); // 5 min timeout

    brain.on("ApiDataReceived", (requestId: bigint, data: string) => {
      console.log(`  ✓  Agent 1 callback fired — API data received`);
      console.log(`      Data: ${data.slice(0, 100)}...`);
      console.log("      Agent 2 (LLM Inference) now reasoning...");
    });

    brain.on("DecisionReceived", async (requestId: bigint, decision: string) => {
      console.log(`\n  ✓  Agent 2 callback fired — Decision: ${decision}`);

      const claimsAfter = await registry.totalClaims();
      if (claimsAfter > claimsBefore) {
        const claim = await registry.getClaim(claimsAfter);
        console.log("\n" + "=".repeat(60));
        console.log("REASONING TRAIL (stored permanently onchain):");
        console.log("=".repeat(60));
        console.log(claim.reasoning || "(no chain-of-thought returned)");
        console.log("=".repeat(60));
        console.log(`\nFINAL DECISION: ${claim.decision}`);
        if (claim.payoutAmount > 0n) {
          console.log(`PAYOUT: ${ethers.formatEther(claim.payoutAmount)} SOMI`);
        }
      }

      clearTimeout(timeout);
      brain.removeAllListeners();
      resolve();
    });

    brain.on("ClaimRejected", async (policyId: bigint, claimant: string) => {
      console.log(`\n  ✓  Claim REJECTED — agent determined no qualifying event.`);
      const claimsAfter = await registry.totalClaims();
      if (claimsAfter > claimsBefore) {
        const claim = await registry.getClaim(claimsAfter);
        console.log("\nREASONING TRAIL:");
        console.log(claim.reasoning || "(no chain-of-thought returned)");
      }
      clearTimeout(timeout);
      brain.removeAllListeners();
      resolve();
    });

    brain.on("PayoutTriggered", (policyId: bigint, claimant: string, amount: bigint) => {
      console.log(`\n  ✓  PAYOUT TRIGGERED: ${ethers.formatEther(amount)} SOMI → ${claimant}`);
    });

    brain.on("FraudFlagged", () => {
      console.log(`\n  ✓  FRAUD FLAG raised.`);
      clearTimeout(timeout);
      brain.removeAllListeners();
      resolve();
    });
  });

  console.log("\nTest complete. Check the frontend Agent Log for the full reasoning trail.");
}

main().catch(err => {
  console.error("Test failed:", err.message);
  process.exit(1);
});
