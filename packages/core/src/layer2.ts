import { InanoSQLInstance } from '@nano-sql/core'
import { Field } from '@zkopru/babyjubjub'
import { Grove } from '@zkopru/tree'
import AsyncLock from 'async-lock'
import { ChainConfig, NodeType, BlockStatus } from '@zkopru/database'
import { L1Config } from './layer1'
import { Block, blockToSqlObj, Header, blockFromLayer1Tx } from './block'
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

  async needBootstrapping(): Promise<boolean> {
    if (this.nodeType !== NodeType.FULL_NODE) {
      // TODO query and check the date
      return true
    }
    return false
  }

  async latestBlock(): Promise<Field> {
    return new Promise<Field>(resolve => {
      this.lock.acquire('latest', () => {
        resolve(this.latest)
      })
    })
  }

  async bootstrap(bootstrapData?: BootstrapData) {
    if (bootstrapData) {
      //
    }
    await this.db.query('select').exec()
    // this.grove = new Grove(config.zkopru, )
  }

  async getOldestUnverifiedBlock(): Promise<{
    prevHeader?: Header
    block?: Block
  }> {
    const lastVerified = await this.db
      .query('select', ['hash', 'proposedAt', 'header', 'MAX(proposedAt)'])
      .where(['status', 'IN', [BlockStatus.VERIFIED, BlockStatus.FINALIZED]])
      .exec()
    if (lastVerified.length > 0) {
      const lastVerifiedBlock = lastVerified[0]
      const prevHeader = lastVerifiedBlock.header

      const lastUnverified = await this.db
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

  async apply(block: Block) {
    // 1. check status
    await this.db
      .selectTable('block')
      .query('upsert', blockToSqlObj(block))
      .exec()
  }
}
