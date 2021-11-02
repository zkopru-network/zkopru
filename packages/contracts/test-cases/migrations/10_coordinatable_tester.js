const CoordinatableTester = artifacts.require("CoordinatableTester");

module.exports = function migration(deployer) {
  return deployer.then(async () => {
    await deployer.deploy(CoordinatableTester);
  });
};
