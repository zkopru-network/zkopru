const Poseidon = artifacts.require('Poseidon')
const TestERC20 = artifacts.require('TestERC20')
const UserInteractable = artifacts.require('UserInteractable')
const Coordinatable = artifacts.require('Coordinatable')
const RollUpable = artifacts.require('RollUpable')
const RollUpChallenge = artifacts.require('RollUpChallenge')
const DepositChallenge = artifacts.require('DepositChallenge')
const HeaderChallenge = artifacts.require('HeaderChallenge')
const TxChallenge = artifacts.require('TxChallenge')
const MigrationChallenge = artifacts.require('MigrationChallenge')
const Migratable = artifacts.require('Migratable')
const ZkOPRU = artifacts.require('ZkOptimisticRollUp')

const instances = {}

module.exports = function migration(deployer, _, accounts) {
  deployer
    .then(() => {
      return TestERC20.deployed()
    })
    .then(erc20 => {
      instances.erc20 = erc20
      return UserInteractable.deployed()
    })
    .then(ui => {
      instances.ui = ui
      return Coordinatable.deployed()
    })
    .then(coordinatable => {
      instances.coordinatable = coordinatable
      return RollUpable.deployed()
    })
    .then(rollUp => {
      instances.rollup = rollUp
      return RollUpChallenge.deployed()
    })
    .then(rollUpChallenge => {
      instances.rollUpChallenge = rollUpChallenge
      return HeaderChallenge.deployed()
    })
    .then(headerChallenge => {
      instances.headerChallenge = headerChallenge
      return TxChallenge.deployed()
    })
    .then(txChallenge => {
      instances.txChallenge = txChallenge
      return DepositChallenge.deployed()
    })
    .then(depositChallenge => {
      instances.depositChallenge = depositChallenge
      return MigrationChallenge.deployed()
    })
    .then(migrationChallenge => {
      instances.migrationChallenge = migrationChallenge
      return Migratable.deployed()
    })
    .then(migratable => {
      instances.migratable = migratable
      return ZkOPRU.deployed()
    })
    .then(async zkopru => {
      console.log(`Deployed ZKOPRU at:\n${zkopru.address}`)
      // Setup proxy
      await zkopru.makeCoordinatable(instances.coordinatable.address)
      await zkopru.makeUserInteractable(instances.ui.address)
      await zkopru.makeRollUpable(instances.rollup.address)
      await zkopru.makeChallengeable(
        instances.depositChallenge.address,
        instances.headerChallenge.address,
        instances.migrationChallenge.address,
        instances.rollUpChallenge.address,
        instances.txChallenge.address,
      )
      await zkopru.makeMigratable(instances.migratable.address)
      // Setup zkSNARKs
      // await wizard.registerVk(...)
      // Setup migrations
      // await wizard.allowMigrants(...)
      // Complete setup
      await zkopru.completeSetup()
    })
}
