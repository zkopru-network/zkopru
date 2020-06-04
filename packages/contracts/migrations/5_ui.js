const Poseidon6 = artifacts.require('Poseidon6')
const MiMC = artifacts.require('MiMC')
const UserInteractable = artifacts.require('UserInteractable')

module.exports = function migration(deployer) {
  deployer.link(Poseidon6, UserInteractable)
  deployer.link(MiMC, UserInteractable)
  deployer.deploy(UserInteractable)
}
