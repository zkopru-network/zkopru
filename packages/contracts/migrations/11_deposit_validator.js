const DepositValidator = artifacts.require('DepositValidator')

module.exports = function migration(deployer) {
  deployer.deploy(DepositValidator)
}
