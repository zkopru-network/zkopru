import { InanoSQLInstance } from '@nano-sql/core'
import { Field } from '@zkopru/babyjubjub'
import { Grove } from '@zkopru/tree'
import AsyncLock from 'async-lock'
import { ChainConfig, NodeType, schema, BlockSql } from '@zkopru/database'
import { L1Config } from './layer1'
import { Block, Header, blockFromLayer1Tx } from './block'
import { BootstrapData } from './bootstrap'

export class L2Chain implements ChainConfig {
  id: string

  networkId: number

  chainId: number

  address: string

  nodeType: NodeType

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
    this.nodeType = chainConfig.nodeType
    this.config = chainConfig.config
    this.latest = Field.zero
    this.lock = new AsyncLock()
  }

  async getBlock(hash: string): Promise<BlockSql | null> {
    const queryResult = await this.db
      .selectTable(schema.block(this.id).name)
      .presetQuery('getBlockWithHash', { hash })
      .exec()
    if (queryResult.length === 0) return null
    return queryResult[0] as BlockSql
  }

  async getOldestUnverifiedBlock(): Promise<{
    prevHeader?: Header
    block?: Block
  }> {
    const lastVerified = await this.db
      .selectTable(schema.block(this.id).name)
      .presetQuery('getLastVerifiedBlock')
      .exec()
    if (lastVerified.length > 0) {
      const lastVerifiedBlock = lastVerified[0]
      const prevHeader = lastVerifiedBlock.header
      const lastUnverified = await this.db
        .selectTable(schema.block(this.id).name)
        .query('select', ['header', 'txData', 'MIN(proposedAt)'])
        .where(['header.parentBlock', '=', prevHeader.hash])
        .exec()
      const block = blockFromLayer1Tx(lastUnverified[0].txData)
      if (lastUnverified.length > 0) {
        return {
          prevHeader,
          block,
        }
      }
    }
    return {}
  }

  async applyBootstrap(block: Block, bootstrapData: BootstrapData) {
    this.grove.applyBootstrap(bootstrapData)
    this.db
      .selectTable(schema.block(this.id).name)
      .presetQuery('bootstrapBlock', { block })
      .exec()
  }

  async markAsPartiallyVerified(hash: string) {
    this.db
      .selectTable(schema.block(this.id).name)
      .presetQuery('markAsPartiallyVerified', { hash })
      .exec()
  }

  async markAsFullyVerified(hash: string) {
    this.db
      .selectTable(schema.block(this.id).name)
      .presetQuery('markAsFullyVerified', { hash })
  }

  async markAsFinalized(hash: string) {
    this.db
      .selectTable(schema.block(this.id).name)
      .presetQuery('markAsFinalized', { hash })
  }

  async markAsInvalidated(hash: string) {
    this.db
      .selectTable(schema.block(this.id).name)
      .presetQuery('markAsInvalidated', { hash })
  }
}
