const Poseidon2 = artifacts.require("Poseidon2");
const UtxoTreeTester = artifacts.require("UtxoTreeTester");

module.exports = function migration(deployer, _, accounts) {
  deployer.link(Poseidon2, UtxoTreeTester);
  // deployer.deploy(UtxoTreeTester)
};
