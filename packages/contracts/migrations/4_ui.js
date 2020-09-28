const Poseidon3 = artifacts.require('Poseidon3')
const Poseidon4 = artifacts.require('Poseidon4')
const UserInteractable = artifacts.require('UserInteractable')

module.exports = function migration(deployer) {
  deployer.link(Poseidon3, UserInteractable)
  deployer.link(Poseidon4, UserInteractable)
  deployer.deploy(UserInteractable)
}
