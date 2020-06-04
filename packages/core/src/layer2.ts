import { InanoSQLInstance } from '@nano-sql/core'
import { Grove, GrovePatch } from '@zkopru/tree'
import AsyncLock from 'async-lock'
import {
  ChainConfig,
  schema,
  BlockSql,
  DepositSql,
  L1Config,
} from '@zkopru/database'
import { Transaction } from 'web3-core'
import { Bytes32 } from 'soltypes'
import { logger } from '@zkopru/utils'
import { Block, Header, VerifyResult, MassDeposit, sqlToHeader } from './block'
import { BootstrapData } from './bootstrap'

export interface Patch {
  result: VerifyResult
  block: Bytes32
  massDeposits?: Bytes32[]
  treePatch?: GrovePatch
}

export class L2Chain implements ChainConfig {
  id: string

  networkId: number

  chainId: number

  address: string

  lock: AsyncLock

  config: L1Config

  grove: Grove

  db: InanoSQLInstance

  latest?: string

  constructor(db: InanoSQLInstance, grove: Grove, chainConfig: ChainConfig) {
    this.db = db
    this.grove = grove
    this.id = chainConfig.id
    this.networkId = chainConfig.networkId
    this.chainId = chainConfig.chainId
    this.address = chainConfig.address
    this.config = chainConfig.config
    this.lock = new AsyncLock()
  }

  async getBlockSql(hash: Bytes32): Promise<BlockSql | null> {
    const queryResult = await this.db
      .selectTable(schema.block.name)
      .presetQuery('getBlockWithHash', { hash: hash.toString() })
      .exec()
    if (queryResult.length === 0) return null
    return queryResult[0] as BlockSql
  }

  async getLatestBlockHash(): Promise<Bytes32 | null> {
    const lastVerified = await this.db
      .selectTable(schema.block.name)
      .presetQuery('getLastVerifiedBlock')
      .exec()
    const lastVerifiedBlock = lastVerified[0]
    return lastVerifiedBlock.hash ? Bytes32.from(lastVerifiedBlock.hash) : null
  }

  async getBlock(hash: Bytes32): Promise<Block | null> {
    const blockSql = await this.getBlockSql(hash)
    if (!blockSql) return null
    const txData = blockSql.proposalData as Transaction
    if (!txData) return null
    console.log('txData is', txData)
    return Block.fromTx(txData)
  }

  async getDeposits(massDeposit: MassDeposit): Promise<DepositSql[]> {
    const commitIndexArr = await this.db
      .selectTable(schema.massDeposit.name)
      .presetQuery('getCommitIndex', {
        merged: massDeposit.merged.toString(),
        fee: massDeposit.fee.toString(),
        zkopru: this.id,
      })
      .exec()
    const commitIndex = commitIndexArr[0].index
    console.log(
      'retrieved,',
      await this.db
        .selectTable(schema.massDeposit.name)
        .query('select')
        .exec(),
    )
    console.log(
      'queried',
      massDeposit.merged.toString(),
      massDeposit.fee.toString(),
      this.id,
    )
    console.log('commitIndex is', commitIndex)
    if (!commitIndex) throw Error('Failed to find the mass deposit')
    console.log(
      'raw select deposit',
      await this.db
        .selectTable(schema.deposit.name)
        .query('select')
        // .where(['queuedAt', 'IN', ['0']])
        .exec(),
    )
    const deposits = (await this.db
      .selectTable(schema.deposit.name)
      .presetQuery('getDeposits', {
        commitIndexes: [commitIndex.toString()],
        zkopru: this.id,
      })
      .exec()) as DepositSql[]
    console.log('unsorted deposits', deposits)
    deposits.sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) {
        return a.blockNumber - b.blockNumber
      }
      if (a.transactionIndex !== b.transactionIndex) {
        return a.transactionIndex - b.transactionIndex
      }
      return a.logIndex - b.logIndex
    })
    return deposits
  }

  async getOldestUnverifiedBlock(): Promise<{
    prevHeader?: Header
    block?: Block
  }> {
    const lastVerified = await this.db
      .selectTable(schema.block.name)
      .presetQuery('getLastVerifiedBlock')
      .exec()
    const lastVerifiedBlock = lastVerified[0] as BlockSql
    const prevHeader = sqlToHeader(lastVerifiedBlock.header)
    const lastUnverified = await this.db
      .selectTable(schema.block.name)
      .query('select', ['header', 'proposalData', 'MIN(proposalNum)'])
      .where(['header.parentBlock', '=', lastVerifiedBlock.hash])
      .exec()
    if (!lastUnverified[0].proposalData) return {}
    const block = Block.fromTx(lastUnverified[0].proposalData)
    return {
      prevHeader,
      block,
    }
  }

  async applyPatch(patch: Patch) {
    logger.info('layer2.ts: applyPatch()')
    const { result, block, treePatch, massDeposits } = patch
    // Apply tree patch
    if (treePatch) {
      if (result === VerifyResult.INVALIDATED)
        throw Error('Invalid result cannot make a patch')
      await this.grove.applyPatch(treePatch)
    }
    // Record the verify result
    if (result === VerifyResult.INVALIDATED) {
      await this.markAsInvalidated(block)
    } else {
      if (!patch) throw Error('patch does not exists')
      if (result === VerifyResult.FULLY_VERIFIED) {
        await this.markAsFullyVerified(block)
      } else {
        await this.markAsPartiallyVerified(block)
      }
    }
    // Update mass deposits inclusion status
    if (massDeposits) {
      await this.markMassDepositsAsIncludedIn(massDeposits, block)
    }
  }

  async applyBootstrap(block: Block, bootstrapData: BootstrapData) {
    this.grove.applyBootstrap(bootstrapData)
    this.db
      .selectTable(schema.block.name)
      .presetQuery('bootstrapBlock', { block })
      .exec()
  }

  async finalize(hash: Bytes32) {
    await this.markAsFinalized(hash)
  }

  private async markMassDepositsAsIncludedIn(ids: Bytes32[], block: Bytes32) {
    this.db
      .selectTable(schema.massDeposit.name)
      .presetQuery('markAsIncludedIn', {
        zkopru: this.id,
        block: block.toString(),
        ids: ids.map(val => val.toString()),
      })
      .exec()
  }

  private async markAsPartiallyVerified(hash: Bytes32) {
    this.db
      .selectTable(schema.block.name)
      .presetQuery('markAsPartiallyVerified', { hash: hash.toString() })
      .exec()
  }

  private async markAsFullyVerified(hash: Bytes32) {
    this.db
      .selectTable(schema.block.name)
      .presetQuery('markAsFullyVerified', { hash: hash.toString() })
  }

  private async markAsFinalized(hash: Bytes32) {
    this.db
      .selectTable(schema.block.name)
      .presetQuery('markAsFinalized', { hash: hash.toString() })
  }

  private async markAsInvalidated(hash: Bytes32) {
    this.db
      .selectTable(schema.block.name)
      .presetQuery('markAsInvalidated', { hash: hash.toString() })
  }
}
