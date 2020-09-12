/* eslint-disable camelcase */
const fs = require('fs')
const path = require('path')
const save = require('../utils/save-deployed')

const TestERC20 = artifacts.require('TestERC20')
const TestERC721 = artifacts.require('TestERC721')
const UserInteractable = artifacts.require('UserInteractable')
const Coordinatable = artifacts.require('Coordinatable')
const DepositChallenge = artifacts.require('DepositChallenge')
const HeaderChallenge = artifacts.require('HeaderChallenge')
const UtxoTreeChallenge = artifacts.require('UtxoTreeChallenge')
const WithdrawalTreeChallenge = artifacts.require('WithdrawalTreeChallenge')
const NullifierTreeChallenge = artifacts.require('NullifierTreeChallenge')
const TxChallenge = artifacts.require('TxChallenge')
const MigrationChallenge = artifacts.require('MigrationChallenge')
const Migratable = artifacts.require('Migratable')
const ZkOPRU = artifacts.require('ZkOptimisticRollUp')

const instances = {}

module.exports = function migration(deployer, network, accounts) {
  deployer
    .then(() => {
      return TestERC20.deployed()
    })
    .then(erc20 => {
      instances.erc20 = erc20
      return TestERC721.deployed()
    })
    .then(erc721 => {
      instances.erc721 = erc721
      return UserInteractable.deployed()
    })
    .then(ui => {
      instances.ui = ui
      return Coordinatable.deployed()
    })
    .then(coordinatable => {
      instances.coordinatable = coordinatable
      return UtxoTreeChallenge.deployed()
    })
    .then(utxoTreeChallenge => {
      instances.utxoTreeChallenge = utxoTreeChallenge
      return WithdrawalTreeChallenge.deployed()
    })
    .then(withdrawalTreeChallenge => {
      instances.withdrawalTreeChallenge = withdrawalTreeChallenge
      return NullifierTreeChallenge.deployed()
    })
    .then(nullifierTreeChallenge => {
      instances.nullifierTreeChallenge = nullifierTreeChallenge
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
      // Save deployed addresses
      save({
        name: 'TestERC20',
        address: instances.erc20.address,
        network: deployer.network_id,
      })
      save({
        name: 'TestERC721',
        address: instances.erc721.address,
        network: deployer.network_id,
      })
      save({
        name: 'ZkOptimisticRollUp',
        address: zkopru.address,
        network: deployer.network_id,
      })
      // Setup proxy
      await zkopru.makeCoordinatable(instances.coordinatable.address)
      await zkopru.makeUserInteractable(instances.ui.address)
      await zkopru.makeChallengeable(
        instances.depositChallenge.address,
        instances.headerChallenge.address,
        instances.migrationChallenge.address,
        instances.utxoTreeChallenge.address,
        instances.withdrawalTreeChallenge.address,
        instances.nullifierTreeChallenge.address,
        instances.txChallenge.address,
      )
      await zkopru.makeMigratable(instances.migratable.address)
      if (network === 'integrationtest') {
        // integration test will run the below steps manually.
        return
      }
      // Setup zkSNARKs
      // Setup migrations
      const keyDir = path.join(__dirname, '../keys/vks')
      const vkToInput = (nIn, nOut, vk) => {
        return [
          nIn,
          nOut,
          {
            alfa1: vk.vk_alfa_1.slice(0, 2),
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
          await zkopru.registerVk(...vkToInput(nIn, nOut, vk))
        }
      }
      // await wizard.allowMigrants(...)
      // Complete setup
      await zkopru.completeSetup()
      if (network === 'testnet') {
        const coordinatable = await Coordinatable.at(zkopru.address)
        // Register as coordinator
        await coordinatable.register({ value: '32000000000000000000' })
      }
    })
}
