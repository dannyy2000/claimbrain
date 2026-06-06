import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

async function main() {
  const [deployer] = await ethers.getSigners();

  const policyBrainAbi = [
    "function getRules(uint256 policyId) view returns (tuple(uint256 ruleId, uint256 policyId, string condition, uint256 payoutAmount, string ruleType, uint256 priority, bool active, uint256 createdAt, address createdBy)[])",
    "function getFraudHistory(address claimant) view returns (uint256 claimsThisYear, bool hasFraudFlag)",
    "function getCustomerTier(address claimant) view returns (string tier)",
    "function getRulesCount(uint256 policyId) view returns (uint256)",
  ];

  const pb = new ethers.Contract(process.env.POLICY_BRAIN_ADDRESS!, policyBrainAbi, deployer);

  const [claimsThisYear, hasFraudFlag] = await pb.getFraudHistory(deployer.address);
  const tier = await pb.getCustomerTier(deployer.address);
  const rulesCount = await pb.getRulesCount(1n);

  console.log("=== DEPLOYER STATE ===");
  console.log(`Address:       ${deployer.address}`);
  console.log(`claimsThisYear: ${claimsThisYear}`);
  console.log(`hasFraudFlag:   ${hasFraudFlag}`);
  console.log(`tier:           ${tier}`);
  console.log(`rulesCount(1):  ${rulesCount}`);

  console.log("\n=== RULES FOR POLICY #1 ===");
  const rules = await pb.getRules(1n);
  if (rules.length === 0) {
    console.log("NO RULES FOUND — this is why REJECT fires! No conditions exist.");
  }
  for (const r of rules) {
    console.log(`  Rule #${r.ruleId}: [${r.ruleType}] priority=${r.priority} active=${r.active}`);
    console.log(`    condition:    ${r.condition}`);
    console.log(`    payoutAmount: ${ethers.formatEther(r.payoutAmount)} SOMI`);
  }
}
main().catch(console.error);

async function main2() {
  const [deployer] = await ethers.getSigners();
  const poolAbi = ["function getPurchasedAt(uint256 policyId, address holder) view returns (uint256)"];
  const pool = new ethers.Contract(process.env.INSURANCE_POOL_ADDRESS!, poolAbi, deployer);
  const purchasedAt = await pool.getPurchasedAt(1n, deployer.address);
  const now = BigInt(Math.floor(Date.now() / 1000));
  const holdingDays = Number((now - purchasedAt) / 86400n);
  console.log(`\npurchasedAt: ${purchasedAt} (${new Date(Number(purchasedAt)*1000).toISOString()})`);
  console.log(`holding_days: ${holdingDays}`);
}
main2().catch(console.error);
