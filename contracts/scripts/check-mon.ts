import { ethers } from "hardhat";
async function main() {
  const [d] = await ethers.getSigners();
  const mon = new ethers.Contract(
    "0x3d343209aB055323B83D3E9307baB6dA78040922",
    ["function claimBrain() view returns (address)"],
    d
  );
  const cb = await mon.claimBrain();
  console.log("MonitoringContract.claimBrain:", cb);
  console.log("Current ClaimBrain in .env:  ", process.env.CLAIM_BRAIN_ADDRESS);
  console.log("Match:", cb.toLowerCase() === process.env.CLAIM_BRAIN_ADDRESS!.toLowerCase());
}
main().catch(console.error);
