const Poseidon = artifacts.require('Poseidon')
const MiMC = artifacts.require('MiMC')
const UserInteractable = artifacts.require('UserInteractable')

module.exports = function migration(deployer) {
  deployer.link(Poseidon, UserInteractable)
  deployer.link(MiMC, UserInteractable)
  deployer.deploy(UserInteractable)
}
