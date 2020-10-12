const TxSNARKValidator = artifacts.require('TxSNARKValidator')

module.exports = function migration(deployer) {
  deployer.deploy(TxSNARKValidator)
}
