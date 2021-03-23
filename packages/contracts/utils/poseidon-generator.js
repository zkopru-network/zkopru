console.log("> Compiling Poseidon library");
const path = require("path");
const fs = require("fs");

const poseidonGenContract = require("circomlib/src/poseidon_gencontract.js");
const Artifactor = require("@truffle/artifactor");

const contractsDir = path.join(__dirname, "..", "build/generated");
const artifactor = new Artifactor(contractsDir);
fs.mkdirSync(contractsDir, { recursive: true });
(async () => {
  await artifactor.save({
    contractName: "Poseidon2",
    abi: poseidonGenContract.generateABI(2),
    unlinked_binary: poseidonGenContract.createCode(2)
  });
  await artifactor.save({
    contractName: "Poseidon3",
    abi: poseidonGenContract.generateABI(3),
    unlinked_binary: poseidonGenContract.createCode(3)
  });
  await artifactor.save({
    contractName: "Poseidon4",
    abi: poseidonGenContract.generateABI(4),
    unlinked_binary: poseidonGenContract.createCode(4)
  });
})();
