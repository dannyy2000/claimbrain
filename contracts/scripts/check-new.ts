import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

async function main() {
  const [deployer] = await ethers.getSigners();
  const provider = deployer.provider!;

  const brainAbi = [
    "function pendingClaims(uint256) view returns (uint256 policyId, address claimant, string protocolOrFlight, string rawApiData, uint8 stage)",
  ];
  const regAbi = [
    "function totalClaims() view returns (uint256)",
    "function getClaim(uint256) view returns (tuple(uint256,uint256,address,string,string,uint256,uint256,uint256))",
  ];

  const BRAIN_ADDR = process.env.CLAIM_BRAIN_ADDRESS!;
  const brain    = new ethers.Contract(BRAIN_ADDR, brainAbi, deployer);
  const registry = new ethers.Contract(process.env.CLAIM_REGISTRY_ADDRESS!, regAbi, deployer);

  const block  = await provider.getBlockNumber();
  const total  = await registry.totalClaims();
  const LATEST_REQ = 5102777n;
  const p = await brain.pendingClaims(LATEST_REQ);

  console.log(`Block: ${block}`);
  console.log(`ClaimBrain: ${BRAIN_ADDR}`);
  console.log(`Total claims in registry: ${total}`);
  console.log(`\nRequest ${LATEST_REQ} pending state:`);
  console.log(`  stage: ${p.stage} (0=done, 1=awaiting API, 2=awaiting LLM)`);
  console.log(`  protocol: ${p.protocolOrFlight}`);
  console.log(`  rawApiData: ${p.rawApiData || "(empty)"}`);

  if (total > 0n) {
    for (let i = 1n; i <= total; i++) {
      const c = await registry.getClaim(i);
      console.log(`\nClaim #${c[0]}: ${c[3]} | Payout: ${ethers.formatEther(c[5])} SOMI`);
      console.log(`  Reasoning: ${c[4] || "(none)"}`);
    }
  }
}
main().catch(console.error);
