const Zkopru = artifacts.require('Zkopru')
const BurnAuction = artifacts.require('BurnAuction')

module.exports = function migration(deployer) {
  deployer
    .then(() => {
      return Zkopru.deployed()
    })
    .then(zkopru => {
      return deployer.deploy(BurnAuction, zkopru.address)
    })
}
