const Poseidon2 = artifacts.require('Poseidon2')
const Poseidon3 = artifacts.require('Poseidon3')
const Poseidon4 = artifacts.require('Poseidon4')

module.exports = function migration(deployer) {
  return deployer.then(async () => {
    await deployer.deploy(Poseidon2)
    await deployer.deploy(Poseidon3)
    await deployer.deploy(Poseidon4)
  })
}
