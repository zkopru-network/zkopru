const MigrationValidator = artifacts.require('MigrationValidator')

module.exports = function migration(deployer) {
  deployer.deploy(MigrationValidator)
}
