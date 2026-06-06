import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

const PLATFORM = "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} SOMI\n`);

  const ClaimBrain = await ethers.getContractFactory("ClaimBrain");
  const claimBrain = await ClaimBrain.deploy(
    PLATFORM,
    process.env.POLICY_BRAIN_ADDRESS!,
    process.env.INSURANCE_POOL_ADDRESS!,
    process.env.CLAIM_REGISTRY_ADDRESS!
  );
  await claimBrain.waitForDeployment();
  const address = await claimBrain.getAddress();
  console.log(`ClaimBrain (new): ${address}`);

  // Re-authorise on all three contracts
  const authoriseABI = ["function setAuthorised(address caller, bool status) external"];
  for (const contractAddr of [
    process.env.POLICY_BRAIN_ADDRESS!,
    process.env.CLAIM_REGISTRY_ADDRESS!,
    process.env.INSURANCE_POOL_ADDRESS!,
  ]) {
    const c = new ethers.Contract(contractAddr, authoriseABI, deployer);
    await (await c.setAuthorised(address, true)).wait();
  }
  console.log("Re-authorised on PolicyBrain, ClaimRegistry, InsurancePool.");

  // Update MonitoringContract to point to new ClaimBrain
  const monitoringABI = ["function setClaimBrain(address _claimBrain) external"];
  const monitoring = new ethers.Contract(process.env.MONITORING_CONTRACT_ADDRESS!, monitoringABI, deployer);
  await (await monitoring.setClaimBrain(address)).wait();
  console.log("MonitoringContract updated.\n");

  console.log("--- Update in .env and frontend/.env ---");
  console.log(`CLAIM_BRAIN_ADDRESS=${address}`);
  console.log(`VITE_CLAIM_BRAIN_ADDRESS=${address}`);
}

main().catch(err => { console.error(err); process.exit(1); });
