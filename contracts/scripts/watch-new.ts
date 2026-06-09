import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

const NEW_BRAIN = "0xB2f0d5e66D75F1cBf3461bDc9DA306D85bccE0eC";
const NEW_REQ   = 5074478n;

const regAbi = [
  "function totalClaims() view returns (uint256)",
  "function getClaim(uint256) view returns (tuple(uint256,uint256,address,string,string,uint256,uint256,uint256))",
];
const brainAbi = [
  "function pendingClaims(uint256) view returns (uint256,address,string,string,uint8)",
];

async function main() {
  const [deployer] = await ethers.getSigners();
  const registry = new ethers.Contract(process.env.CLAIM_REGISTRY_ADDRESS!, regAbi, deployer);
  const brain    = new ethers.Contract(NEW_BRAIN, brainAbi, deployer);

  let lastTotal  = await registry.totalClaims() as bigint;
  console.log(`Watching request ${NEW_REQ} on ${NEW_BRAIN}`);
  console.log(`Current claims: ${lastTotal}. Polling every 10s...\n`);

  async function tick() {
    const block = await deployer.provider!.getBlockNumber();
    const total = await registry.totalClaims() as bigint;
    const p     = await brain.pendingClaims(NEW_REQ);
    const stage = p[4];

    process.stdout.write(`\r[Block ${block}] Stage: ${stage} | Claims: ${total}   `);

    if (total > lastTotal) {
      console.log(`\n\n${"=".repeat(50)}`);
      console.log("NEW CLAIM SETTLED!");
      for (let i = lastTotal + 1n; i <= total; i++) {
        const c = await registry.getClaim(i);
        console.log(`Claim #${c[0]}`);
        console.log(`Decision:  ${c[3]}`);
        console.log(`Payout:    ${ethers.formatEther(c[5])} SOMI`);
        console.log(`Reasoning: ${c[4] || "(empty)"}`);
      }
      console.log("=".repeat(50));
      lastTotal = total;
    }
  }

  await tick();
  setInterval(tick, 10_000);
}

main().catch(console.error);
