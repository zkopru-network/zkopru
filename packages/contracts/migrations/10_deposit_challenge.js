const DepositChallenge = artifacts.require('DepositChallenge')

module.exports = function migration(deployer) {
  deployer.deploy(DepositChallenge)
}
