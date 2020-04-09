import { InanoSQLInstance } from '@nano-sql/core'
import { Field } from '@zkopru/babyjubjub'
import { Grove } from '@zkopru/tree'
import AsyncLock from 'async-lock'
import { ZkOPRUSql } from '@zkopru/database'
import { Challenge } from './challenge'
import { Configuration } from './layer1'
import { Block } from './block'
import { VerifyingKey } from './snark'
import { BootstrapData } from './bootstrap'

export enum NodeType {
  FULL_NODE,
  LIGHT_NODE,
}

export class Layer2 {
  lock: AsyncLock

  config: Configuration

  grove!: Grove

  nodeType: NodeType

  db: InanoSQLInstance

  latest: Field

  vks: {
    [txType: string]: VerifyingKey
  }

  constructor(
    db: InanoSQLInstance,
    nodeType: NodeType,
    config: Configuration,
    vks?: {
      [txType: string]: VerifyingKey
    },
  ) {
    this.config = config
    this.db = db
    this.latest = Field.zero
    this.lock = new AsyncLock()
    this.nodeType = nodeType
    this.vks = vks || {}
  }

  async needBootstrapping(): Promise<boolean> {
    if (this.nodeType === NodeType.LIGHT_NODE) {
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

  async apply(block: Block) {
    console.log(block, this)
  }

  async verify(
    block: Block,
    onChallenge: (challenge: Challenge) => Promise<void>,
  ) {
    console.log(block, this)
    onChallenge({ block })
  }

  static async with(
    db: InanoSQLInstance,
    networkId: number,
    chainId: number,
    address: string,
  ): Promise<Layer2 | null> {
    const zkopru: ZkOPRUSql[] = (await db
      .selectTable('zkopru')
      .presetQuery('read', {
        networkId,
        chainId,
        address,
      })
      .exec()) as ZkOPRUSql[]
    if (zkopru[0]) {
      return new Layer2(db, zkopru[0].nodeType, zkopru[0].config)
    }
    return null
  }
}
