const Poseidon3 = artifacts.require('Poseidon3')
const RollUpable = artifacts.require('RollUpable')

module.exports = function migration(deployer) {
  deployer.link(Poseidon3, RollUpable)
  deployer.deploy(RollUpable)
}
