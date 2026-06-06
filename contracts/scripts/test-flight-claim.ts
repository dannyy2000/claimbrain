// Flight delay claim test.
// AviationStack free tier often lacks 2hr+ live delays, so we pass a rich
// event context in protocolOrFlight that tells the LLM exactly what happened.
// The JSON API oracle still fetches real AviationStack data for the record.
import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

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
];
const CLAIM_REGISTRY_ABI = [
  "function totalClaims() view returns (uint256)",
  "function getClaim(uint256 claimId) view returns (tuple(uint256,uint256,address,string,string,uint256,uint256,uint256))",
];
const PLATFORM_ABI = ["function getRequestDeposit() view returns (uint256)"];
const PLATFORM_ADDRESS = "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776";

async function main() {
  const [deployer] = await ethers.getSigners();
  const provider   = deployer.provider!;

  console.log("=".repeat(60));
  console.log("CLAIMBRAIN — Flight Delay Claim Test");
  console.log("=".repeat(60));
  console.log(`Wallet:  ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await provider.getBalance(deployer.address))} SOMI\n`);

  const pool     = new ethers.Contract(process.env.INSURANCE_POOL_ADDRESS!, INSURANCE_POOL_ABI, deployer);
  const brain    = new ethers.Contract(process.env.CLAIM_BRAIN_ADDRESS!, CLAIM_BRAIN_ABI, deployer);
  const registry = new ethers.Contract(process.env.CLAIM_REGISTRY_ADDRESS!, CLAIM_REGISTRY_ABI, deployer);
  const platform = new ethers.Contract(PLATFORM_ADDRESS, PLATFORM_ABI, deployer);

  // ── Step 1: Pool state ────────────────────────────────────────────────────
  console.log("[ 1 ] Checking flight delay pool (policy #2)...");
  const poolBal = await pool.getPoolBalance(2n);
  const premium  = await pool.getPremium(2n);
  console.log(`      Pool balance: ${ethers.formatEther(poolBal)} SOMI`);
  console.log(`      Premium:      ${ethers.formatEther(premium)} SOMI`);

  // ── Step 2: Buy policy if needed ──────────────────────────────────────────
  console.log("\n[ 2 ] Checking flight policy status...");
  const alreadyActive = await pool.isActive(2n, deployer.address);
  if (!alreadyActive) {
    console.log("      No active flight policy — buying...");
    const buyTx = await pool.buyPolicy(2n, ethers.parseEther("0.5"), { value: premium });
    await buyTx.wait();
    console.log(`      Policy purchased: ${buyTx.hash}`);
  } else {
    console.log("      Active flight policy found.");
  }

  // ── Step 3: Deposit ───────────────────────────────────────────────────────
  console.log("\n[ 3 ] Checking deposit requirement...");
  const floor = await platform.getRequestDeposit();
  const totalDeposit = floor * 32n;
  console.log(`      Deposit: ${ethers.formatEther(totalDeposit)} SOMI`);

  // ── Step 4: Submit claim ──────────────────────────────────────────────────
  console.log("\n[ 4 ] Initiating flight delay claim...");

  // Rich context so the LLM has full picture even if AviationStack data is partial.
  // AviationStack free tier may not expose 2hr+ live delays, so context is explicit.
  const FLIGHT = "AA123";
  const API_KEY = process.env.AVIATIONSTACK_API_KEY!;
  const API_URL = `https://api.aviationstack.com/v1/flights?access_key=${API_KEY}&flight_iata=${FLIGHT}&limit=1`;
  const SELECTOR = "arrival.delay";

  // Context tells the LLM exactly what the event is
  const claimEvent = `${FLIGHT} | delay_minutes=320 | delay_hours=5.3 | cause=MECHANICAL_FAILURE | AA123 DFW->OGG suffered a 5h20m mechanical delay on 2026-06-06, well above the 2-hour threshold for payout`;

  console.log(`      Flight:   ${FLIGHT}`);
  console.log(`      Context:  5h20m mechanical delay (above 2hr threshold)`);
  console.log(`      Deposit:  ${ethers.formatEther(totalDeposit)} SOMI`);

  const claimTx = await brain.initiateClaim(
    2n,
    deployer.address,
    claimEvent,
    API_URL,
    SELECTOR,
    { value: totalDeposit }
  );

  console.log(`      Tx sent: ${claimTx.hash}`);
  const receipt = await claimTx.wait();
  console.log(`      Confirmed in block ${receipt.blockNumber}`);

  const initiatedEvent = receipt.logs
    .map((log: any) => { try { return brain.interface.parseLog(log); } catch { return null; } })
    .find((e: any) => e?.name === "ClaimInitiated");
  if (initiatedEvent) console.log(`      Request ID: ${initiatedEvent.args.requestId}`);

  // ── Step 5: Poll for result ───────────────────────────────────────────────
  console.log("\n[ 5 ] Waiting for agent callbacks (polling every 10s, max 8 min)...\n");
  const claimsBefore = await registry.totalClaims();
  const reqId = initiatedEvent?.args?.requestId ?? 0n;

  for (let i = 0; i < 48; i++) {
    await new Promise(r => setTimeout(r, 10_000));
    const claimsAfter = await registry.totalClaims();
    if (claimsAfter > claimsBefore) {
      const claim = await registry.getClaim(claimsAfter);
      console.log(`\n${"=".repeat(60)}`);
      console.log("FLIGHT CLAIM — SETTLED");
      console.log("=".repeat(60));
      console.log(`DECISION:  ${claim[3]}`);
      console.log(`PAYOUT:    ${ethers.formatEther(claim[5])} SOMI`);
      console.log(`REQUEST:   ${claim[6]}`);
      console.log("\nREASONING TRAIL (stored onchain):");
      console.log(claim[4] || "(no chain-of-thought)");
      console.log("=".repeat(60));
      return;
    }
    if (i % 3 === 0) process.stdout.write(`      [${(i+1)*10}s] waiting...\n`);
  }
  console.log("\nTimeout — check check-new.ts for result.");
}

main().catch(err => { console.error(err.message); process.exit(1); });
