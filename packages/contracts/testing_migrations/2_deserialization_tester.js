const fs = require('fs')

const DeserializationTester = artifacts.require('DeserializationTester')

module.exports = function migration(deployer, _, accounts) {
  deployer.deploy(DeserializationTester).then(contract => {
    const deployed = {
      name: 'DeserializationTester',
      address: contract.address,
      network: deployer.network_id,
    }
    const data = JSON.stringify(deployed, null, 2)
    if (!fs.existsSync('build/deployed')) {
      fs.mkdirSync('build/deployed')
    }
    fs.writeFileSync('build/deployed/DeserializationTester.json', data)
  })
}
