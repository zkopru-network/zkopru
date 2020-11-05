const SNARK = artifacts.require('SNARK')
const TxSNARKValidator = artifacts.require('TxSNARKValidator')

module.exports = function migration(deployer) {
  deployer.link(SNARK, TxSNARKValidator)
  deployer.deploy(TxSNARKValidator)
}
