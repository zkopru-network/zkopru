const Migratable = artifacts.require('Migratable')

module.exports = function migration(deployer) {
  deployer.deploy(Migratable)
}
