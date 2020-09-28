const fs = require('fs')

const Poseidon2 = artifacts.require('Poseidon2')
const ZkOPRU = artifacts.require('ZkOptimisticRollUp')

module.exports = function migration(deployer, _, accounts) {
  deployer.link(Poseidon2, ZkOPRU)
  deployer.deploy(ZkOPRU, accounts[0])
}
