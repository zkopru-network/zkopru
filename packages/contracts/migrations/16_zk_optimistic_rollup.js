const Poseidon2 = artifacts.require('Poseidon2')
const Zkopru = artifacts.require('Zkopru')

module.exports = function migration(deployer, _, accounts) {
  deployer.then(async () => {
    await deployer.deploy(Poseidon2, { overwrite: false })
    await deployer.link(Poseidon2, Zkopru)
    await deployer.deploy(Zkopru, accounts[0])
  })
}
