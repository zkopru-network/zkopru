const fs = require('fs')

const DeserializationTester = artifacts.require('DeserializationTester')

module.exports = function migration(deployer, _, accounts) {
  if (deployer.network !== 'test') return
  deployer.deploy(DeserializationTester)
}
