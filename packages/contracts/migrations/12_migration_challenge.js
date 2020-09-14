const MigrationChallenge = artifacts.require('MigrationChallenge')

module.exports = function migration(deployer) {
  deployer.deploy(MigrationChallenge)
}
