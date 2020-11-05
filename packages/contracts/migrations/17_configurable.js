const Configurable = artifacts.require('Configurable')

module.exports = function migration(deployer) {
  deployer.deploy(Configurable)
}
