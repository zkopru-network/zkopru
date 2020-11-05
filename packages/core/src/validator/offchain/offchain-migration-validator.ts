import { ZkOutflow } from '@zkopru/transaction'
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
  async validateDuplicatedDestination(
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
      slashable: migration1.destination.eq(migration2.destination),
      reason: CODE.M1,
    }
    return slash
  }

  async validateTotalEth(
    data: BlockData,
    migrationIndex: Uint256,
  ): Promise<Validation> {
    const block = blockDataToBlock(data)
    // get target migration
    const migration =
      block.body.massMigrations[migrationIndex.toBN().toNumber()]
    // initialize total ETH value
    let totalETH = new BN(0)
    // Filter outflow using the destination address
    const migrationOutflowArr = block.body.txs.reduce((arr, tx) => {
      const filteredOutflow = tx.outflow.filter(outflow =>
        outflow.data?.to.eq(migration.destination.toBN()),
      )
      return [...arr, ...filteredOutflow]
    }, [] as ZkOutflow[])
    // Calculate the sum
    for (const outflow of migrationOutflowArr) {
      assert(outflow.data, 'Filtering error')
      totalETH = totalETH.add(outflow.data.eth)
    }
    // Return the result
    const slash: Validation = {
      slashable: !totalETH.eq(migration.totalETH.toBN()),
      reason: CODE.M2,
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
      const filteredOutflow = tx.outflow.filter(outflow =>
        outflow.data?.to.eq(migration.destination.toBN()),
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
      slashable: migration.migratingLeaves.merged.eq(Bytes32.from(merged)),
      reason: CODE.M3,
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
      const filteredOutflow = tx.outflow.filter(outflow =>
        outflow.data?.to.eq(migration.destination.toBN()),
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
      slashable: !migration.migratingLeaves.fee.toBN().eq(migrationFee),
      reason: CODE.M4,
    }
    return slash
  }

  async validateDuplicatedERC20Migration(
    data: BlockData,
    migrationIndex: Uint256,
    erc20Idx1: Uint256,
    erc20Idx2: Uint256,
  ): Promise<Validation> {
    const block = blockDataToBlock(data)
    // get target migration
    const migration =
      block.body.massMigrations[migrationIndex.toBN().toNumber()]
    const erc20Migration1 = migration.erc20[erc20Idx1.toBN().toNumber()]
    const erc20Migration2 = migration.erc20[erc20Idx2.toBN().toNumber()]
    // Return the result
    const slash: Validation = {
      slashable: erc20Migration1.addr.eq(erc20Migration2.addr),
      reason: CODE.M5,
    }
    return slash
  }

  async validateERC20Amount(
    data: BlockData,
    migrationIndex: Uint256,
    erc20Idx: Uint256,
  ): Promise<Validation> {
    const block = blockDataToBlock(data)
    // get target migration
    const migration =
      block.body.massMigrations[migrationIndex.toBN().toNumber()]
    const erc20Migration = migration.erc20[erc20Idx.toBN().toNumber()]
    // Filter outflow using the destination address and token address
    const migrationOutflowArr = block.body.txs.reduce((arr, tx) => {
      const filteredOutflow = tx.outflow.filter(
        outflow =>
          outflow.data?.to.eq(migration.destination.toBN()) &&
          outflow.data?.tokenAddr.eq(erc20Migration.addr.toBN()),
      )
      return [...arr, ...filteredOutflow]
    }, [] as ZkOutflow[])
    // Calculate the token amount
    let tokenAmount: BN = new BN(0)
    for (const amount of migrationOutflowArr.map(
      outflow => outflow.data?.erc20Amount,
    )) {
      assert(amount, 'Filtering error')
      tokenAmount = tokenAmount.add(amount)
    }
    // Return the result
    const slash: Validation = {
      slashable: !erc20Migration.amount.toBN().eq(tokenAmount),
      reason: CODE.M6,
    }
    return slash
  }

  async validateDuplicatedERC721Migration(
    data: BlockData,
    migrationIndex: Uint256,
    erc721Idx1: Uint256,
    erc721Idx2: Uint256,
  ): Promise<Validation> {
    const block = blockDataToBlock(data)
    // get target migration
    const migration =
      block.body.massMigrations[migrationIndex.toBN().toNumber()]
    const erc721Migration1 = migration.erc721[erc721Idx1.toBN().toNumber()]
    const erc721Migration2 = migration.erc721[erc721Idx2.toBN().toNumber()]
    // Return the result
    const slash: Validation = {
      slashable: erc721Migration1.addr.eq(erc721Migration2.addr),
      reason: CODE.M7,
    }
    return slash
  }

  async validateNonFungibility(
    data: BlockData,
    migrationIndex: Uint256,
    erc721Idx: Uint256,
    tokenId: Uint256,
  ): Promise<Validation> {
    const block = blockDataToBlock(data)
    // get target migration
    const migration =
      block.body.massMigrations[migrationIndex.toBN().toNumber()]
    const erc721Migration = migration.erc721[erc721Idx.toBN().toNumber()]
    // Filter outflow using the destination address and token address
    const migrationOutflowArr = block.body.txs.reduce((arr, tx) => {
      const filteredOutflow = tx.outflow.filter(
        outflow =>
          outflow.data?.to.eq(migration.destination.toBN()) &&
          outflow.data?.tokenAddr.eq(erc721Migration.addr.toBN()) &&
          outflow.data?.nft.eq(tokenId.toBN()) &&
          !tokenId.toBN().eqn(0),
      )
      return [...arr, ...filteredOutflow]
    }, [] as ZkOutflow[])
    // Return the result
    const slash: Validation = {
      // NFT cannot exists more than 1
      slashable: migrationOutflowArr.length > 1,
      reason: CODE.M8,
    }
    return slash
  }

  async validateNftExistence(
    data: BlockData,
    migrationIndex: Uint256,
    erc721Idx: Uint256,
    tokenId: Uint256,
  ): Promise<Validation> {
    const block = blockDataToBlock(data)
    // get target migration
    const migration =
      block.body.massMigrations[migrationIndex.toBN().toNumber()]
    const erc721Migration = migration.erc721[erc721Idx.toBN().toNumber()]
    const nftsToMigrate = erc721Migration.nfts.filter(nft => nft.eq(tokenId))
    // Filter outflow using the destination address and token address
    const migrationOutflowArr = block.body.txs.reduce((arr, tx) => {
      const filteredOutflow = tx.outflow.filter(
        outflow =>
          outflow.data?.to.eq(migration.destination.toBN()) &&
          outflow.data?.tokenAddr.eq(erc721Migration.addr.toBN()) &&
          outflow.data?.nft.eq(tokenId.toBN()) &&
          !tokenId.toBN().eqn(0),
      )
      return [...arr, ...filteredOutflow]
    }, [] as ZkOutflow[])
    // Return the result
    const slash: Validation = {
      // NFT cannot exists more than 1
      slashable: nftsToMigrate.length !== migrationOutflowArr.length,
      reason: CODE.M9,
    }
    return slash
  }
}
