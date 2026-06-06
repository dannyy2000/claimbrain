import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

async function main() {
  const [deployer] = await ethers.getSigners();
  const provider   = deployer.provider!;

  const abi = [
    "function pendingClaims(uint256) view returns (uint256 policyId, address claimant, string protocolOrFlight, string rawApiData, uint8 stage)",
    "function getRules(uint256 policyId) view returns (tuple(uint256,uint256,string,uint256,string,uint256,bool,uint256,address)[])",
  ];
  const registryAbi = [
    "function totalClaims() view returns (uint256)",
    "function getClaimsByClaimant(address) view returns (tuple(uint256,uint256,address,string,string,uint256,uint256,uint256)[])",
  ];

  const NEW_CLAIM_BRAIN = "0x014e1e888202411c7290eC9d44025Df20C8Ffe55";
  const brain    = new ethers.Contract(NEW_CLAIM_BRAIN, abi, deployer);
  const registry = new ethers.Contract(process.env.CLAIM_REGISTRY_ADDRESS!, registryAbi, deployer);

  const block = await provider.getBlockNumber();
  console.log(`Current block: ${block}`);

  // Check new request
  const REQUEST_ID = 5067523n;
  const p = await brain.pendingClaims(REQUEST_ID);
  console.log(`\nRequest ${REQUEST_ID} on new ClaimBrain:`);
  console.log(`  policyId: ${p.policyId}`);
  console.log(`  claimant: ${p.claimant}`);
  console.log(`  protocol: ${p.protocolOrFlight}`);
  console.log(`  stage:    ${p.stage} (0=not found/done, 1=awaiting API, 2=awaiting LLM)`);

  // Check total claims
  const total = await registry.totalClaims();
  console.log(`\nTotal claims in registry: ${total}`);

  // Check claims for our wallet
  const claims = await registry.getClaimsByClaimant(deployer.address);
  if (claims.length > 0) {
    console.log(`\nClaims for ${deployer.address}:`);
    for (const c of claims) {
      console.log(`  Claim #${c[0]} — Decision: ${c[3]} — Payout: ${ethers.formatEther(c[5])} SOMI`);
      if (c[4]) console.log(`  Reasoning: ${c[4].slice(0, 200)}...`);
    }
  } else {
    console.log(`\nNo settled claims for this wallet yet.`);
  }
}
main().catch(console.error);
