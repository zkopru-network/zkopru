const Poseidon2 = artifacts.require('Poseidon2')
const UtxoTreeValidator = artifacts.require('UtxoTreeValidator')

module.exports = function migration(deployer) {
  deployer.link(Poseidon2, UtxoTreeValidator)
  deployer.deploy(UtxoTreeValidator)
}
