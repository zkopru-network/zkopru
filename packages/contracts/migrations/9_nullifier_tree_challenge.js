const NullifierTreeChallenge = artifacts.require('NullifierTreeChallenge')

module.exports = function migration(deployer) {
  deployer.deploy(NullifierTreeChallenge)
}
