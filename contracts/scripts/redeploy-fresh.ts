// Redeploys PolicyBrain + ClaimBrain fresh.
// Keeps InsurancePool + ClaimRegistry (deployer's policy + claim history preserved).
// Run: npx hardhat run scripts/redeploy-fresh.ts --network somnia-testnet
import { ethers } from "hardhat";
import * as dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
dotenv.config({ path: "../.env" });

const PLATFORM = "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Balance:  ${ethers.formatEther(await deployer.provider.getBalance(deployer.address))} SOMI\n`);

  const INSURANCE_POOL   = process.env.INSURANCE_POOL_ADDRESS!;
  const CLAIM_REGISTRY   = process.env.CLAIM_REGISTRY_ADDRESS!;
  const MONITORING       = process.env.MONITORING_CONTRACT_ADDRESS!;

  // 1. Fresh PolicyBrain
  console.log("Deploying PolicyBrain...");
  const PolicyBrain = await ethers.getContractFactory("PolicyBrain");
  const policyBrain = await PolicyBrain.deploy();
  await policyBrain.waitForDeployment();
  const pbAddr = await policyBrain.getAddress();
  console.log(`PolicyBrain: ${pbAddr}`);

  // 2. Seed rules via DefiHackModule
  console.log("Seeding DeFi Hack rules...");
  const DefiHackModule = await ethers.getContractFactory("DefiHackModule");
  const defiModule     = await DefiHackModule.deploy(pbAddr);
  await defiModule.waitForDeployment();
  await (await policyBrain.setAuthorised(await defiModule.getAddress(), true)).wait();
  await (await defiModule.seedRules()).wait();
  console.log(`DefiHackModule: ${await defiModule.getAddress()} (seeded)`);

  // 3. Fresh ClaimBrain (improved prompt)
  console.log("Deploying ClaimBrain...");
  const ClaimBrain = await ethers.getContractFactory("ClaimBrain");
  const claimBrain = await ClaimBrain.deploy(PLATFORM, pbAddr, INSURANCE_POOL, CLAIM_REGISTRY);
  await claimBrain.waitForDeployment();
  const cbAddr = await claimBrain.getAddress();
  console.log(`ClaimBrain: ${cbAddr}`);

  // 4. Authorize new ClaimBrain on all contracts
  console.log("Authorizing ClaimBrain...");
  const authAbi = ["function setAuthorised(address caller, bool status) external"];
  for (const addr of [pbAddr, CLAIM_REGISTRY, INSURANCE_POOL]) {
    const c = new ethers.Contract(addr, authAbi, deployer);
    await (await c.setAuthorised(cbAddr, true)).wait();
  }
  console.log("Authorized on PolicyBrain, ClaimRegistry, InsurancePool.");

  // 5. Update MonitoringContract
  const monAbi = ["function setClaimBrain(address _claimBrain) external"];
  const monitoring = new ethers.Contract(MONITORING, monAbi, deployer);
  await (await monitoring.setClaimBrain(cbAddr)).wait();
  console.log("MonitoringContract updated.\n");

  // 6. Print new addresses
  const envLines = [
    `POLICY_BRAIN_ADDRESS=${pbAddr}`,
    `CLAIM_BRAIN_ADDRESS=${cbAddr}`,
  ];
  console.log("--- Update your .env ---");
  envLines.forEach(l => console.log(l));
  console.log("\n--- Update your frontend/.env ---");
  console.log(`VITE_POLICY_BRAIN_ADDRESS=${pbAddr}`);
  console.log(`VITE_CLAIM_BRAIN_ADDRESS=${cbAddr}`);
  console.log("------------------------\n");

  // 7. Auto-patch ../.env
  const envPath = path.resolve(__dirname, "../../.env");
  if (fs.existsSync(envPath)) {
    let env = fs.readFileSync(envPath, "utf8");
    env = env.replace(/^POLICY_BRAIN_ADDRESS=.*/m,  `POLICY_BRAIN_ADDRESS=${pbAddr}`);
    env = env.replace(/^CLAIM_BRAIN_ADDRESS=.*/m,   `CLAIM_BRAIN_ADDRESS=${cbAddr}`);
    fs.writeFileSync(envPath, env);
    console.log("Auto-patched ../.env");
  }

  // 8. Auto-patch frontend/.env
  const frontenvPath = path.resolve(__dirname, "../../frontend/.env");
  if (fs.existsSync(frontenvPath)) {
    let env = fs.readFileSync(frontenvPath, "utf8");
    env = env.replace(/^VITE_POLICY_BRAIN_ADDRESS=.*/m,  `VITE_POLICY_BRAIN_ADDRESS=${pbAddr}`);
    env = env.replace(/^VITE_CLAIM_BRAIN_ADDRESS=.*/m,   `VITE_CLAIM_BRAIN_ADDRESS=${cbAddr}`);
    fs.writeFileSync(frontenvPath, env);
    console.log("Auto-patched frontend/.env");
  }

  console.log("\nDone. Deployer now has fresh claim history (0 claims, no fraud flag).");
  console.log("Run: npx hardhat run scripts/test-claim.ts --network somnia-testnet");
}

main().catch(err => { console.error(err); process.exit(1); });
