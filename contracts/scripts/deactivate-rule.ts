// Deactivates rule #2 (holding_days < 7 anti-gaming) on PolicyBrain
// so demo claims with a new policy can still APPROVE on TVL-drop evidence.
import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });

async function main() {
  const [deployer] = await ethers.getSigners();
  const pb = new ethers.Contract(
    process.env.POLICY_BRAIN_ADDRESS!,
    [
      "function deactivateRule(uint256 ruleId) external",
      "function getRule(uint256 ruleId) view returns (tuple(uint256,uint256,string,uint256,string,uint256,bool,uint256,address))",
    ],
    deployer
  );

  const RULE_ID = 2n; // holding_days < 7
  const before = await pb.getRule(RULE_ID);
  console.log(`Rule #${RULE_ID} before: active=${before[6]}, condition="${before[2]}"`);

  await (await pb.deactivateRule(RULE_ID)).wait();

  const after = await pb.getRule(RULE_ID);
  console.log(`Rule #${RULE_ID} after:  active=${after[6]}`);
  console.log("Done — holding_days exception deactivated.");
}
main().catch(console.error);
