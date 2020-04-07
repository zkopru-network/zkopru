const Poseidon = artifacts.require('Poseidon')
const RollUpable = artifacts.require('RollUpable')

module.exports = function migration(deployer) {
  deployer.link(Poseidon, RollUpable)
  deployer.deploy(RollUpable)
}
