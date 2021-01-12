/* eslint-disable camelcase */
const fs = require('fs')
const path = require('path')
const save = require('../utils/save-deployed')

const TestERC20 = artifacts.require('TestERC20')
const TestERC721 = artifacts.require('TestERC721')
const UserInteractable = artifacts.require('UserInteractable')
const Coordinatable = artifacts.require('Coordinatable')
const Challengeable = artifacts.require('Challengeable')
const DepositValidator = artifacts.require('DepositValidator')
const HeaderValidator = artifacts.require('HeaderValidator')
const UtxoTreeValidator = artifacts.require('UtxoTreeValidator')
const WithdrawalTreeValidator = artifacts.require('WithdrawalTreeValidator')
const NullifierTreeValidator = artifacts.require('NullifierTreeValidator')
const TxValidator = artifacts.require('TxValidator')
const MigrationValidator = artifacts.require('MigrationValidator')
const Migratable = artifacts.require('Migratable')
const Configurable = artifacts.require('Configurable')
const BurnAuction = artifacts.require('BurnAuction')
const Zkopru = artifacts.require('Zkopru')

const instances = {}

module.exports = function migration(deployer, network, accounts) {
  deployer.then(async () => {
    // tokens
    const instances = {}
    instances.erc20 = await TestERC20.deployed()
    instances.erc721 = await TestERC721.deployed()
    // controllers
    instances.ui = await UserInteractable.deployed()
    instances.coordinatable = await Coordinatable.deployed()
    instances.migratable = await Migratable.deployed()
    instances.configurable = await Configurable.deployed()
    instances.challengeable = await Challengeable.deployed()
    // challenge validators
    instances.utxoTreeValidator = await UtxoTreeValidator.deployed()
    instances.withdrawalTreeValidator = await WithdrawalTreeValidator.deployed()
    instances.nullifierTreeValidator = await NullifierTreeValidator.deployed()
    instances.headerValidator = await HeaderValidator.deployed()
    instances.txValidator = await TxValidator.deployed()
    instances.depositValidator = await DepositValidator.deployed()
    instances.migrationValidator = await MigrationValidator.deployed()
    // consensus
    instances.burnAuction = await BurnAuction.deployed()
    // migration source
    const source = await Zkopru.deployed()
    // migration destination
    const dest = await Zkopru.new()
    const destAuction = await BurnAuction.new(dest.address)

    console.log(`Deployed ZKOPRU 2 at:\n${dest.address}`)
    // Save deployed addresses
    save({
      name: 'Zkopru2',
      address: dest.address,
      network: deployer.network_id,
    })
    // Setup proxy
    await dest.makeCoordinatable(instances.coordinatable.address)
    await dest.makeUserInteractable(instances.ui.address)
    await dest.makeChallengeable(
      instances.challengeable.address,
      instances.depositValidator.address,
      instances.headerValidator.address,
      instances.migrationValidator.address,
      instances.utxoTreeValidator.address,
      instances.withdrawalTreeValidator.address,
      instances.nullifierTreeValidator.address,
      instances.txValidator.address,
    )
    await dest.makeMigratable(instances.migratable.address)
    await dest.makeConfigurable(instances.configurable.address)
    const configurable = await Configurable.at(dest.address)
    await configurable.setConsensusProvider(destAuction.address)
    // Setup zkSNARKs
    // Setup migrations
    const keyDir = path.join(__dirname, '../keys/vks')
    const vkToInput = (nIn, nOut, vk) => {
      return [
        nIn,
        nOut,
        {
          alpha1: vk.vk_alpha_1.slice(0, 2),
          beta2: vk.vk_beta_2.slice(0, 2),
          gamma2: vk.vk_gamma_2.slice(0, 2),
          delta2: vk.vk_delta_2.slice(0, 2),
          ic: vk.IC.map(arr => arr.slice(0, 2)),
        },
      ]
    }
    // console.log(path.resolve(keyDir))
    for (let nIn = 1; nIn <= 4; nIn += 1) {
      for (let nOut = 1; nOut <= 4; nOut += 1) {
        const vk = JSON.parse(
          fs.readFileSync(
            path.join(keyDir, `/zk_transaction_${nIn}_${nOut}.vk.json`),
          ),
        )
        await dest.registerVk(...vkToInput(nIn, nOut, vk))
      }
    }
    // await wizard.allowMigrants(...)

    const coordinatable = await Coordinatable.at(dest.address)
    // register erc20
    await coordinatable.registerERC20(instances.erc20.address)
    // register erc721
    await coordinatable.registerERC721(instances.erc721.address)
    // Complete setup
    await dest.completeSetup()
    if (network === 'testnet') {
      // Register as coordinator
      const configurable = await Configurable.at(dest.address)
      await configurable.setChallengePeriod(30)
      await instances.burnAuction.register({ value: '32000000000000000000' })
    }
  })
}
