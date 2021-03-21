const path = require('path')

const Artifactor = require('@truffle/artifactor')

module.exports = function migration(deployer) {
  return deployer.then(async () => {
    await deployer.deploy(artifacts.require('Poseidon2'))
    await deployer.deploy(artifacts.require('Poseidon3'))
    await deployer.deploy(artifacts.require('Poseidon4'))
  })
}
