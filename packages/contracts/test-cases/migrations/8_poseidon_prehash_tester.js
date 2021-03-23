const PoseidonTester = artifacts.require("PoseidonTester");
const Poseidon2 = artifacts.require("Poseidon2");
const Poseidon3 = artifacts.require("Poseidon3");
const Poseidon4 = artifacts.require("Poseidon4");

module.exports = function migration(deployer) {
  return deployer.then(async () => {
    await deployer.link(Poseidon2, PoseidonTester);
    await deployer.link(Poseidon3, PoseidonTester);
    await deployer.link(Poseidon4, PoseidonTester);
    await deployer.deploy(PoseidonTester);
  });
};
