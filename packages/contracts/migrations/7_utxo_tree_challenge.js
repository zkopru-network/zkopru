const Poseidon3 = artifacts.require('Poseidon3')
const UtxoTreeChallenge = artifacts.require('UtxoTreeChallenge')

module.exports = function migration(deployer) {
  deployer.link(Poseidon3, UtxoTreeChallenge)
  deployer.deploy(UtxoTreeChallenge)
}
