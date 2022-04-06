// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers } from "hardhat";
import { deploy } from "../utils/deployer";

async function main() {
  const [deployer] = await ethers.getSigners();
  const { zkopru } = await deploy(deployer);
  console.log("Zkopru is deployed to: ", zkopru.zkopru.address);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
