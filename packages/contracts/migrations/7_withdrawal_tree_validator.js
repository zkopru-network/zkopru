const WithdrawalTreeValidator = artifacts.require('WithdrawalTreeValidator')

module.exports = function migration(deployer) {
  deployer.deploy(WithdrawalTreeValidator)
}
