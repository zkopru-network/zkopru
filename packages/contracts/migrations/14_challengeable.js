const Challengeable = artifacts.require('Challengeable')

module.exports = function migration(deployer) {
  deployer.deploy(Challengeable)
}
