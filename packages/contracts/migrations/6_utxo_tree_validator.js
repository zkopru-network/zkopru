const Poseidon2 = artifacts.require('Poseidon2')
const UtxoTreeValidator = artifacts.require('UtxoTreeValidator')

module.exports = function migration(deployer) {
  deployer.then(async () => {
    await deployer.deploy(Poseidon2, { overwrite: false })
    await deployer.link(Poseidon2, UtxoTreeValidator)
    await deployer.deploy(UtxoTreeValidator)
  })
}
