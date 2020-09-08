const WithdrawalTreeChallenge = artifacts.require('WithdrawalTreeChallenge')

module.exports = function migration(deployer) {
  deployer.deploy(WithdrawalTreeChallenge)
}
