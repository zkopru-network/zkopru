const DeserializationTester = artifacts.require("DeserializationTester");

module.exports = function migration(deployer, _, accounts) {
  deployer.deploy(DeserializationTester);
};
