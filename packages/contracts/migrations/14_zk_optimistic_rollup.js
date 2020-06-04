const fs = require('fs')

const Poseidon6 = artifacts.require('Poseidon6')
const ZkOPRU = artifacts.require('ZkOptimisticRollUp')

module.exports = function migration(deployer, _, accounts) {
  deployer.link(Poseidon6, ZkOPRU)
  deployer.deploy(ZkOPRU, accounts[0])
}
