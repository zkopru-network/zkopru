const TxValidator = artifacts.require('TxValidator')

module.exports = function migration(deployer) {
  deployer.deploy(TxValidator)
}
