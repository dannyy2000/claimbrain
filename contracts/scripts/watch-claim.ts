import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

const CLAIM_REGISTRY_ABI = [
  "function totalClaims() view returns (uint256)",
  "function getClaim(uint256 claimId) view returns (tuple(uint256 claimId, uint256 policyId, address claimant, string decision, string reasoning, uint256 payoutAmount, uint256 requestId, uint256 timestamp))",
  "function getClaimsByClaimant(address claimant) view returns (tuple(uint256 claimId, uint256 policyId, address claimant, string decision, string reasoning, uint256 payoutAmount, uint256 requestId, uint256 timestamp)[])",
];

const CLAIM_BRAIN_ABI = [
  "function pendingClaims(uint256 requestId) view returns (uint256 policyId, address claimant, string protocolOrFlight, string rawApiData, uint8 stage)",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  const provider   = deployer.provider!;

  const registry = new ethers.Contract(
    process.env.CLAIM_REGISTRY_ADDRESS!,
    CLAIM_REGISTRY_ABI,
    deployer
  );

  const brain = new ethers.Contract(
    process.env.CLAIM_BRAIN_ADDRESS!,
    CLAIM_BRAIN_ABI,
    deployer
  );

  console.log("=".repeat(60));
  console.log("CLAIMBRAIN — Watching for settled claims...");
  console.log("Polling every 15 seconds. Ctrl+C to stop.");
  console.log("=".repeat(60));

  let lastClaimCount = await registry.totalClaims() as bigint;
  let lastBlock      = await provider.getBlockNumber();

  console.log(`Total claims so far: ${lastClaimCount}`);
  console.log(`Starting from block: ${lastBlock}\n`);

  // Also check pending claim from last test
  try {
    const REQUEST_ID = 5064712n;
    const pending = await brain.pendingClaims(REQUEST_ID);
    if (pending.policyId > 0n) {
      console.log(`Request ${REQUEST_ID} is still pending (stage ${pending.stage})`);
      console.log(`Agent 1 processing...`);
    } else {
      console.log(`Request ${REQUEST_ID} no longer pending — may have resolved.`);
    }
  } catch {
    // ignore
  }

  async function poll() {
    try {
      const currentBlock = await provider.getBlockNumber();
      const totalClaims  = await registry.totalClaims() as bigint;

      if (totalClaims > lastClaimCount) {
        console.log(`\n${"=".repeat(60)}`);
        console.log(`NEW CLAIM SETTLED! (${lastClaimCount} → ${totalClaims})`);
        console.log("=".repeat(60));

        for (let i = lastClaimCount + 1n; i <= totalClaims; i++) {
          const claim = await registry.getClaim(i);
          console.log(`\nClaim #${claim.claimId}`);
          console.log(`Policy:    ${claim.policyId === 1n ? "DeFi Hack" : "Flight Delay"}`);
          console.log(`Claimant:  ${claim.claimant}`);
          console.log(`Decision:  ${claim.decision}`);
          console.log(`Payout:    ${ethers.formatEther(claim.payoutAmount)} SOMI`);
          console.log(`Timestamp: ${new Date(Number(claim.timestamp) * 1000).toLocaleString()}`);

          if (claim.reasoning) {
            console.log(`\nREASONING TRAIL:`);
            console.log("-".repeat(40));
            console.log(claim.reasoning);
            console.log("-".repeat(40));
          } else {
            console.log(`\n(No reasoning trail returned — chainOfThought may not have been captured)`);
          }
        }

        lastClaimCount = totalClaims;
      } else {
        process.stdout.write(`\r[Block ${currentBlock}] Waiting for agent callbacks... (${totalClaims} claims settled so far)`);
      }

      lastBlock = currentBlock;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stdout.write(`\r[polling error — retrying] ${msg.slice(0, 60)}`);
    }
  }

  // Poll every 15 seconds
  await poll();
  setInterval(poll, 15_000);
}

main().catch(console.error);
