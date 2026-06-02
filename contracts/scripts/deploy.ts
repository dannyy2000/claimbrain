import { ethers } from "hardhat";

// Somnia platform contract addresses
const PLATFORM: Record<string, string> = {
  "somnia-testnet": "0x037Bb9C718F3f7fe5eCBDB0b600D607b52706776",
  somnia:           "0x5E5205CF39E766118C01636bED000A54D93163E6",
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const network    = (await ethers.provider.getNetwork()).name;

  console.log(`Deploying on:  ${network}`);
  console.log(`Deployer:      ${deployer.address}`);
  console.log(`Balance:       ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} SOMI\n`);

  const platformAddress = PLATFORM[network] ?? PLATFORM["somnia-testnet"];

  // 1. PolicyBrain
  const PolicyBrain = await ethers.getContractFactory("PolicyBrain");
  const policyBrain = await PolicyBrain.deploy();
  await policyBrain.waitForDeployment();
  console.log(`PolicyBrain:        ${await policyBrain.getAddress()}`);

  // 2. ClaimRegistry
  const ClaimRegistry = await ethers.getContractFactory("ClaimRegistry");
  const claimRegistry = await ClaimRegistry.deploy();
  await claimRegistry.waitForDeployment();
  console.log(`ClaimRegistry:      ${await claimRegistry.getAddress()}`);

  // 3. InsurancePool
  const InsurancePool = await ethers.getContractFactory("InsurancePool");
  const insurancePool = await InsurancePool.deploy();
  await insurancePool.waitForDeployment();
  console.log(`InsurancePool:      ${await insurancePool.getAddress()}`);

  // 4. ClaimBrain (depends on all above + Somnia platform)
  const ClaimBrain = await ethers.getContractFactory("ClaimBrain");
  const claimBrain = await ClaimBrain.deploy(
    platformAddress,
    await policyBrain.getAddress(),
    await insurancePool.getAddress(),
    await claimRegistry.getAddress()
  );
  await claimBrain.waitForDeployment();
  console.log(`ClaimBrain:         ${await claimBrain.getAddress()}\n`);

  // 5. Authorise ClaimBrain on PolicyBrain, ClaimRegistry, InsurancePool
  console.log("Authorising ClaimBrain...");
  await (await policyBrain.setAuthorised(await claimBrain.getAddress(), true)).wait();
  await (await claimRegistry.setAuthorised(await claimBrain.getAddress(), true)).wait();
  await (await insurancePool.setAuthorised(await claimBrain.getAddress(), true)).wait();
  console.log("Authorised.\n");

  // 6. Deploy and seed DeFi Hack module
  const DefiHackModule = await ethers.getContractFactory("DefiHackModule");
  const defiModule     = await DefiHackModule.deploy(await policyBrain.getAddress());
  await defiModule.waitForDeployment();
  await (await policyBrain.setAuthorised(await defiModule.getAddress(), true)).wait();
  await (await defiModule.seedRules()).wait();
  console.log(`DefiHackModule:     ${await defiModule.getAddress()} (seeded)`);

  // 7. Deploy and seed Flight Delay module
  const FlightDelayModule = await ethers.getContractFactory("FlightDelayModule");
  const flightModule      = await FlightDelayModule.deploy(await policyBrain.getAddress());
  await flightModule.waitForDeployment();
  await (await policyBrain.setAuthorised(await flightModule.getAddress(), true)).wait();
  await (await flightModule.seedRules()).wait();
  console.log(`FlightDelayModule:  ${await flightModule.getAddress()} (seeded)\n`);

  // 8. Deploy MonitoringContract — keeper bot calls this to auto-trigger claims
  const MonitoringContract = await ethers.getContractFactory("MonitoringContract");
  const monitoring = await MonitoringContract.deploy(await claimBrain.getAddress());
  await monitoring.waitForDeployment();
  console.log(`MonitoringContract: ${await monitoring.getAddress()}`);

  // 9. Set premiums for both policy modules
  console.log("Setting premiums...");
  // DeFi Hack: 0.015 SOMI/month premium
  await (await insurancePool.setPremium(1n, ethers.parseEther("0.015"))).wait();
  // Flight Delay: 0.005 SOMI premium per flight
  await (await insurancePool.setPremium(2n, ethers.parseEther("0.005"))).wait();
  console.log("Premiums set.\n");

  // 9. Fund both pools with initial capital so policies can be bought immediately
  console.log("Funding insurance pools...");
  // DeFi Hack pool: 10 SOMI initial liquidity
  await (await insurancePool.fundPool(1n, { value: ethers.parseEther("10") })).wait();
  // Flight Delay pool: 5 SOMI initial liquidity
  await (await insurancePool.fundPool(2n, { value: ethers.parseEther("5") })).wait();
  console.log("Pools funded.\n");

  // 10. Print .env values
  console.log("--- Copy these into your .env ---");
  console.log(`POLICY_BRAIN_ADDRESS=${await policyBrain.getAddress()}`);
  console.log(`CLAIM_REGISTRY_ADDRESS=${await claimRegistry.getAddress()}`);
  console.log(`INSURANCE_POOL_ADDRESS=${await insurancePool.getAddress()}`);
  console.log(`CLAIM_BRAIN_ADDRESS=${await claimBrain.getAddress()}`);
  console.log(`MONITORING_CONTRACT_ADDRESS=${await monitoring.getAddress()}`);
  console.log("---------------------------------");
  console.log("\n--- Copy these into your frontend/.env ---");
  console.log(`VITE_POLICY_BRAIN_ADDRESS=${await policyBrain.getAddress()}`);
  console.log(`VITE_CLAIM_REGISTRY_ADDRESS=${await claimRegistry.getAddress()}`);
  console.log(`VITE_INSURANCE_POOL_ADDRESS=${await insurancePool.getAddress()}`);
  console.log(`VITE_CLAIM_BRAIN_ADDRESS=${await claimBrain.getAddress()}`);
  console.log(`VITE_MONITORING_CONTRACT_ADDRESS=${await monitoring.getAddress()}`);
  console.log("------------------------------------------");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
