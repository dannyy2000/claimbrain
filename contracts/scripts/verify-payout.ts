import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });
async function main() {
  const [d] = await ethers.getSigners();
  const bal = await d.provider.getBalance(d.address);

  const reg = new ethers.Contract(process.env.CLAIM_REGISTRY_ADDRESS!, [
    "function totalClaims() view returns (uint256)",
    "function getClaim(uint256) view returns (tuple(uint256,uint256,address,string,string,uint256,uint256,uint256))"
  ], d);
  const pool = new ethers.Contract(process.env.INSURANCE_POOL_ADDRESS!, [
    "function getPoolBalance(uint256) view returns (uint256)",
    "function isActive(uint256,address) view returns (bool)"
  ], d);

  const total = await reg.totalClaims();
  const lastClaim = await reg.getClaim(total);
  const poolBal = await pool.getPoolBalance(1n);
  const policyActive = await pool.isActive(1n, d.address);

  console.log("=== PAYOUT CONFIRMATION ===");
  console.log(`Recipient wallet: ${d.address}`);
  console.log(`Current balance:  ${ethers.formatEther(bal)} SOMI`);
  console.log("");
  console.log(`=== CLAIM #${lastClaim[0]} ===`);
  console.log(`Decision:   ${lastClaim[3]}`);
  console.log(`Payout:     ${ethers.formatEther(lastClaim[5])} SOMI`);
  console.log(`Request ID: ${lastClaim[6]}`);
  console.log(`Reasoning:  ${lastClaim[4]}`);
  console.log("");
  console.log(`=== POOL STATE ===`);
  console.log(`Pool balance after payout: ${ethers.formatEther(poolBal)} SOMI`);
  console.log(`Policy still active: ${policyActive} (false = consumed by payout)`);
}
main().catch(console.error);
