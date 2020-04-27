const fs = require('fs')

const Poseidon = artifacts.require('Poseidon')
const ZkOPRU = artifacts.require('ZkOptimisticRollUp')

module.exports = function migration(deployer, _, accounts) {
  deployer.link(Poseidon, ZkOPRU)
  deployer.deploy(ZkOPRU, accounts[0]).then(contract => {
    const deployed = {
      name: 'ZkOptimisticRollUp',
      address: contract.address,
      network: deployer.network_id,
    }
    const data = JSON.stringify(deployed, null, 2)
    if (!fs.existsSync('build/deployed')) {
      fs.mkdirSync('build/deployed')
    }
    fs.writeFileSync('build/deployed/ZkOptimisticRollUp.json', data)
  })
}
