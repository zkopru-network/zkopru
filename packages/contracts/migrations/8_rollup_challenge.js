const RollUpChallenge = artifacts.require('RollUpChallenge')

module.exports = function migration(deployer) {
  deployer.deploy(RollUpChallenge)
}
