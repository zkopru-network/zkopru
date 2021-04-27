import { OutflowType, ZkOutflow } from '@zkopru/transaction'
import assert from 'assert'
import BN from 'bn.js'
/* eslint-disable class-methods-use-this */
import { Bytes32, Uint256 } from 'soltypes'
import { soliditySha3Raw } from 'web3-utils'
import { CODE } from '../code'
import { BlockData, MigrationValidator, Validation } from '../types'
import { blockDataToBlock } from '../utils'
import { OffchainValidatorContext } from './offchain-context'

export class OffchainMigrationValidator extends OffchainValidatorContext
  implements MigrationValidator {
  async validateDuplicatedMigrations(
    data: BlockData,
    migrationIndex1: Uint256,
    migrationIndex2: Uint256,
  ): Promise<Validation> {
    const block = blockDataToBlock(data)
    const migration1 =
      block.body.massMigrations[migrationIndex1.toBN().toNumber()]
    const migration2 =
      block.body.massMigrations[migrationIndex2.toBN().toNumber()]
    const slash: Validation = {
      slashable:
        migration1.destination.eq(migration2.destination) &&
        migration1.asset.token.eq(migration2.asset.token),
      reason: CODE.M1,
    }
    return slash
  }

  async validateEthMigration(
    data: BlockData,
    migrationIndex: Uint256,
  ): Promise<Validation> {
    const block = blockDataToBlock(data)
    // get target migration
    const migration =
      block.body.massMigrations[migrationIndex.toBN().toNumber()]
    // initialize total ETH value
    let eth = new BN(0)
    // Filter outflow using the destination address
    const migrationOutflowArr = block.body.txs.reduce((arr, tx) => {
      const filteredOutflow = tx.outflow.filter(
        outflow =>
          outflow.data?.to.eq(migration.destination.toBN()) &&
          outflow.data?.tokenAddr.eq(migration.asset.token.toBN()),
      )
      return [...arr, ...filteredOutflow]
    }, [] as ZkOutflow[])
    // Calculate the sum
    for (const outflow of migrationOutflowArr) {
      assert(outflow.data, 'Filtering error')
      eth = eth.add(outflow.data.eth)
    }
    // Return the result
    const slash: Validation = {
      slashable: !eth.eq(migration.asset.eth.toBN()),
      reason: CODE.M2,
    }
    return slash
  }

  async validateERC20Migration(
    data: BlockData,
    migrationIndex: Uint256,
  ): Promise<Validation> {
    const block = blockDataToBlock(data)
    // get target migration
    const migration =
      block.body.massMigrations[migrationIndex.toBN().toNumber()]
    // initialize total ETH value
    let amount = new BN(0)
    // Filter outflow using the destination address
    const migrationOutflowArr = block.body.txs.reduce((arr, tx) => {
      const filteredOutflow = tx.outflow.filter(
        outflow =>
          outflow.data?.to.eq(migration.destination.toBN()) &&
          outflow.data?.tokenAddr.eq(migration.asset.token.toBN()),
      )
      return [...arr, ...filteredOutflow]
    }, [] as ZkOutflow[])
    // Calculate the sum
    for (const outflow of migrationOutflowArr) {
      assert(outflow.data, 'Filtering error')
      amount = amount.add(outflow.data.erc20Amount)
    }
    // Return the result
    const slash: Validation = {
      slashable: !amount.eq(migration.asset.amount.toBN()),
      reason: CODE.M3,
    }
    return slash
  }

  async validateMergedLeaves(
    data: BlockData,
    migrationIndex: Uint256,
  ): Promise<Validation> {
    const block = blockDataToBlock(data)
    // get target migration
    const migration =
      block.body.massMigrations[migrationIndex.toBN().toNumber()]
    // Filter outflow using the destination address
    const migrationOutflowArr = block.body.txs.reduce((arr, tx) => {
      const filteredOutflow = tx.outflow.filter(
        outflow =>
          outflow.data?.to.eq(migration.destination.toBN()) &&
          outflow.data?.tokenAddr.eq(migration.asset.token.toBN()),
      )
      return [...arr, ...filteredOutflow]
    }, [] as ZkOutflow[])
    // Calculate the merged leaves
    let merged: string = Uint256.from('0')
      .toBytes()
      .toString()
    for (const note of migrationOutflowArr.map(outflow => outflow.note)) {
      merged = soliditySha3Raw(merged, note)
    }
    // Return the result
    const slash: Validation = {
      slashable: migration.depositForDest.merged.eq(Bytes32.from(merged)),
      reason: CODE.M4,
    }
    return slash
  }

  async validateMigrationFee(
    data: BlockData,
    migrationIndex: Uint256,
  ): Promise<Validation> {
    const block = blockDataToBlock(data)
    // get target migration
    const migration =
      block.body.massMigrations[migrationIndex.toBN().toNumber()]
    // Filter outflow using the destination address
    const migrationOutflowArr = block.body.txs.reduce((arr, tx) => {
      const filteredOutflow = tx.outflow.filter(
        outflow =>
          outflow.data?.to.eq(migration.destination.toBN()) &&
          outflow.data?.tokenAddr.eq(migration.asset.token.toBN()),
      )
      return [...arr, ...filteredOutflow]
    }, [] as ZkOutflow[])
    // Calculate the fee
    let migrationFee: BN = new BN(0)
    for (const fee of migrationOutflowArr.map(outflow => outflow.data?.fee)) {
      assert(fee, 'Filtering error')
      migrationFee = migrationFee.add(fee)
    }
    // Return the result
    const slash: Validation = {
      slashable: !migration.depositForDest.fee.toBN().eq(migrationFee),
      reason: CODE.M5,
    }
    return slash
  }

  async validateTokenRegistration(
    data: BlockData,
    migrationIndex: Uint256,
  ): Promise<Validation> {
    const block = blockDataToBlock(data)
    // get target migration
    const migration =
      block.body.massMigrations[migrationIndex.toBN().toNumber()]
    const { token } = migration.asset
    let slashable = false
    // check the token is registered
    if (!token.toBN().eqn(0)) {
      const registeredInfo = await this.layer2.db.findOne('TokenRegistry', {
        where: { address: token.toString() },
      })
      if (!registeredInfo) {
        slashable = true
      } else if (!registeredInfo.isERC20) {
        slashable = true
      }
    }
    // Return the result
    const slash: Validation = {
      slashable,
      reason: CODE.M6,
    }
    return slash
  }

  async validateMissedMassMigration(
    data: BlockData,
    txIndex: Uint256,
    outflowIndex: Uint256,
  ): Promise<Validation> {
    const block = blockDataToBlock(data)
    // get target output
    const transaction = block.body.txs[txIndex.toBN().toNumber()]
    const outflow = transaction.outflow[outflowIndex.toBN().toNumber()]
    let slashable: boolean
    if (outflow.outflowType.eqn(OutflowType.MIGRATION)) {
      // Find mass migration for the given destination
      const dest = outflow.data?.to
      if (!dest) throw Error('Destination does not exist.')
      const token = outflow.data?.tokenAddr
      if (!token) throw Error('Token address does not exist.')
      const migration = block.body.massMigrations.find(mm => {
        return dest.eq(mm.destination.toBN()) && token.eq(mm.asset.token.toBN())
      })
      slashable = migration === undefined
    } else {
      slashable = false
    }
    const slash: Validation = {
      slashable,
      reason: CODE.M7,
    }
    return slash
  }
}
