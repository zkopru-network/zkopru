const Poseidon6 = artifacts.require('Poseidon6')
const UserInteractable = artifacts.require('UserInteractable')

module.exports = function migration(deployer) {
  deployer.link(Poseidon6, UserInteractable)
  deployer.deploy(UserInteractable)
}
