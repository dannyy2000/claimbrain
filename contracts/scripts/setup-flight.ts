// Seeds FlightDelayModule rules for policy 2 on the current PolicyBrain,
// sets premium, and verifies pool balance.
import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deployer: ${deployer.address}`);

  const pb = new ethers.Contract(
    process.env.POLICY_BRAIN_ADDRESS!,
    ["function setAuthorised(address,bool) external", "function getRulesCount(uint256) view returns (uint256)"],
    deployer
  );
  const pool = new ethers.Contract(
    process.env.INSURANCE_POOL_ADDRESS!,
    ["function setPremium(uint256,uint256) external", "function getPoolBalance(uint256) view returns (uint256)", "function getPremium(uint256) view returns (uint256)"],
    deployer
  );

  // 1. Deploy FlightDelayModule
  console.log("Deploying FlightDelayModule...");
  const FlightDelayModule = await ethers.getContractFactory("FlightDelayModule");
  const flightModule = await FlightDelayModule.deploy(process.env.POLICY_BRAIN_ADDRESS!);
  await flightModule.waitForDeployment();
  const fmAddr = await flightModule.getAddress();
  console.log(`FlightDelayModule: ${fmAddr}`);

  // 2. Authorize and seed
  await (await pb.setAuthorised(fmAddr, true)).wait();
  await (await flightModule.seedRules()).wait();
  const count = await pb.getRulesCount(2n);
  console.log(`Rules seeded for policy 2: ${count}`);

  // 3. Set premium for policy 2 (0.005 SOMI)
  await (await pool.setPremium(2n, ethers.parseEther("0.005"))).wait();

  const poolBal = await pool.getPoolBalance(2n);
  const premium  = await pool.getPremium(2n);
  console.log(`Pool 2 balance: ${ethers.formatEther(poolBal)} SOMI`);
  console.log(`Pool 2 premium: ${ethers.formatEther(premium)} SOMI`);
  console.log("\nFlight delay module ready.");
}
main().catch(console.error);
