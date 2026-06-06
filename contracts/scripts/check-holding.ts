import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config({ path: "../.env" });
async function main() {
  const [d] = await ethers.getSigners();
  const pool = new ethers.Contract(
    process.env.INSURANCE_POOL_ADDRESS!,
    ["function getPurchasedAt(uint256,address) view returns (uint256)"],
    d
  );
  const ts = await pool.getPurchasedAt(1n, d.address);
  const now = BigInt(Math.floor(Date.now() / 1000));
  const holdingDays  = Number((now - ts) / 86400n);
  const holdingHours = Number((now - ts) / 3600n);
  console.log(`purchasedAt:   ${ts} => ${new Date(Number(ts) * 1000).toISOString()}`);
  console.log(`holding_days:  ${holdingDays}`);
  console.log(`holding_hours: ${holdingHours}`);
  if (holdingDays < 7) {
    console.log(`\n*** EXCEPTION RULE #2 WILL FIRE (holding_days < 7) — LLM will REJECT ***`);
  } else {
    console.log(`\n*** holding_days >= 7 — APPROVE path is clear ***`);
  }
}
main().catch(console.error);
