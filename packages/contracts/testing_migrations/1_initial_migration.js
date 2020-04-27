const Migrations = artifacts.require('Migrations')

module.exports = function migration(deployer) {
  deployer.deploy(Migrations)
}
