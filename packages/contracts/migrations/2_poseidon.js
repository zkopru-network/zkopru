const path = require('path')

module.exports = function migration(deployer) {
  return deployer.then(async () => {
    await deployer.deploy(artifacts.require('Poseidon2'))
    await deployer.deploy(artifacts.require('Poseidon3'))
    await deployer.deploy(artifacts.require('Poseidon4'))
  })
}
