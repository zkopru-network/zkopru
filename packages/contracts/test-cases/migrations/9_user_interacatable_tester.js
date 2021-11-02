const UserInteractableTester = artifacts.require("UserInteractableTester");
const Poseidon3 = artifacts.require("Poseidon3");
const Poseidon4 = artifacts.require("Poseidon4");

module.exports = function migration(deployer) {
  return deployer.then(async () => {
    await deployer.link(Poseidon3, UserInteractableTester);
    await deployer.link(Poseidon4, UserInteractableTester);
    await deployer.deploy(UserInteractableTester);
  });
};
