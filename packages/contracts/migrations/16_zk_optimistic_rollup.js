const Poseidon2 = artifacts.require('Poseidon2')
const Zkopru = artifacts.require('Zkopru')

module.exports = function migration(deployer, _, accounts) {
  deployer.link(Poseidon2, Zkopru)
  deployer.deploy(Zkopru, accounts[0])
}
