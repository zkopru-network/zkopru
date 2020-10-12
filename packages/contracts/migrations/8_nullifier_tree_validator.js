const NullifierTreeValidator = artifacts.require('NullifierTreeValidator')

module.exports = function migration(deployer) {
  deployer.deploy(NullifierTreeValidator)
}
