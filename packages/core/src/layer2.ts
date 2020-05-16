import { InanoSQLInstance } from '@nano-sql/core'
import { Field } from '@zkopru/babyjubjub'
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
import { Block, Header, VerifyResult, MassDeposit } from './block'
import { BootstrapData } from './bootstrap'

export interface Patch {
  result: VerifyResult
  block: string
  massDeposits?: string[]
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

  latest: Field

  constructor(db: InanoSQLInstance, grove: Grove, chainConfig: ChainConfig) {
    this.db = db
    this.grove = grove
    this.id = chainConfig.id
    this.networkId = chainConfig.networkId
    this.chainId = chainConfig.chainId
    this.address = chainConfig.address
    this.config = chainConfig.config
    this.latest = Field.zero
    this.lock = new AsyncLock()
  }

  async getBlockSql(hash: string): Promise<BlockSql | null> {
    const queryResult = await this.db
      .selectTable(schema.block.name)
      .presetQuery('getBlockWithHash', { hash })
      .exec()
    if (queryResult.length === 0) return null
    return queryResult[0] as BlockSql
  }

  async getBlock(hash: string): Promise<Block | null> {
    const blockSql = await this.getBlockSql(hash)
    if (!blockSql) return null
    const txData = blockSql.proposalData as Transaction
    if (!txData) return null
    return Block.fromTx(txData)
  }

  async getDeposits(massDeposit: MassDeposit): Promise<DepositSql[]> {
    const commitIndexArr = await this.db
      .selectTable(schema.massDeposit.name)
      .presetQuery('getCommitIndex', { ...massDeposit, zkopru: this.id })
      .exec()
    const commitIndex = commitIndexArr[0]
    if (!commitIndex) throw Error('Failed to find the mass deposit')
    const deposits = await this.db
      .selectTable(schema.deposit.name)
      .presetQuery('getDeposits', { commitIndex, zkopru: this.id })
      .exec()
    return deposits as DepositSql[]
  }

  async getOldestUnverifiedBlock(): Promise<{
    prevHeader?: Header
    block?: Block
  }> {
    const lastVerified = await this.db
      .selectTable(schema.block.name)
      .presetQuery('getLastVerifiedBlock')
      .exec()
    if (lastVerified.length > 0) {
      const lastVerifiedBlock = lastVerified[0]
      const prevHeader = lastVerifiedBlock.header
      const lastUnverified = await this.db
        .selectTable(schema.block.name)
        .query('select', ['header', 'proposalData', 'MIN(proposedAt)'])
        .where(['header.parentBlock', '=', prevHeader.hash])
        .exec()
      const block = Block.fromTx(lastUnverified[0].proposalData)
      if (lastUnverified.length > 0) {
        return {
          prevHeader,
          block,
        }
      }
    }
    return {}
  }

  async applyPatch(patch: Patch) {
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

  async finalize(hash: string) {
    await this.markAsFinalized(hash)
  }

  private async markMassDepositsAsIncludedIn(ids: string[], block: string) {
    this.db
      .selectTable(schema.massDeposit.name)
      .presetQuery('markAsIncludedIn', {
        zkopru: this.id,
        block,
        ids,
      })
      .exec()
  }

  private async markAsPartiallyVerified(hash: string) {
    this.db
      .selectTable(schema.block.name)
      .presetQuery('markAsPartiallyVerified', { hash })
      .exec()
  }

  private async markAsFullyVerified(hash: string) {
    this.db
      .selectTable(schema.block.name)
      .presetQuery('markAsFullyVerified', { hash })
  }

  private async markAsFinalized(hash: string) {
    this.db
      .selectTable(schema.block.name)
      .presetQuery('markAsFinalized', { hash })
  }

  private async markAsInvalidated(hash: string) {
    this.db
      .selectTable(schema.block.name)
      .presetQuery('markAsInvalidated', { hash })
  }
}
