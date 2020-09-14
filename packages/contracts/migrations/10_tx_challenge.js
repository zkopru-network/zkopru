const TxChallenge = artifacts.require('TxChallenge')

module.exports = function migration(deployer) {
  deployer.deploy(TxChallenge)
}
