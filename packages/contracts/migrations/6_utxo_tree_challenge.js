const Poseidon2 = artifacts.require('Poseidon2')
const UtxoTreeChallenge = artifacts.require('UtxoTreeChallenge')

module.exports = function migration(deployer) {
  deployer.link(Poseidon2, UtxoTreeChallenge)
  deployer.deploy(UtxoTreeChallenge)
}
