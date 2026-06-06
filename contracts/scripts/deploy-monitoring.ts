import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

async function main() {
  const [deployer] = await ethers.getSigners();

  const claimBrainAddress = process.env.CLAIM_BRAIN_ADDRESS;
  if (!claimBrainAddress) {
    throw new Error("CLAIM_BRAIN_ADDRESS not set in .env");
  }

  console.log(`Deployer: ${deployer.address}`);
  console.log(`ClaimBrain: ${claimBrainAddress}\n`);

  const MonitoringContract = await ethers.getContractFactory("MonitoringContract");
  const monitoring = await MonitoringContract.deploy(claimBrainAddress);
  await monitoring.waitForDeployment();

  const address = await monitoring.getAddress();
  console.log(`MonitoringContract: ${address}`);
  console.log(`\nAdd to .env:\nMONITORING_CONTRACT_ADDRESS=${address}`);
  console.log(`\nAdd to frontend/.env:\nVITE_MONITORING_CONTRACT_ADDRESS=${address}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
