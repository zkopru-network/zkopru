import Web3 from 'web3'
import { logger } from '@zkopru/utils'
import { DB, UpsertOptions, UpdateOptions } from './types'

// process block in memory, write to DB when confirmed by enough blocks

const DEFAULT_BLOCK_CONFIRMATIONS = 15

enum OperationType {
  UPSERT,
  CREATE,
  UPDATE,
}

type PendingDocument = {
  blockNumber: number
  blockHash: string
  collection: string
  operation: OperationType
  where?: any
  create?: any
  update?: any
}

export class BlockCache {
  web3: Web3

  db: DB

  pendingDocs = [] as PendingDocument[]

  currentBlockNumber = 0

  blockHeaderSubscription: any
  BLOCK_CONFIRMATIONS = +(
    process.env.BLOCK_CONFIRMATIONS || DEFAULT_BLOCK_CONFIRMATIONS
  )

  constructor(web3: Web3, db: DB) {
    this.web3 = web3
    this.db = db
    this.blockHeaderSubscription = this.web3.eth
      .subscribe('newBlockHeaders', err => {
        if (err) {
          logger.info('Error subscribing to block headers')
          logger.info(err)
        }
      })
      .on('data', async blockHeader => {
        this.currentBlockNumber = blockHeader.number
        // write stuff if needed
        try {
          await this.writeChangesIfNeeded()
        } catch (err) {
          logger.info('Error writing block cache changes')
          logger.info(err)
        }
      })
  }

  async blockNumber() {
    if (this.currentBlockNumber === 0) {
      // async load it
      this.currentBlockNumber = await this.web3.eth.getBlockNumber()
    }
    return this.currentBlockNumber
  }

  async clearChangesForBlockHash(hash: string) {
    this.pendingDocs = this.pendingDocs.filter(({ blockHash }) => {
      return blockHash !== hash
    })
  }

  // Write any data that is old enough to be considered confirmed
  async writeChangesIfNeeded() {
    const docsToRemove = [] as any[]
    for (const doc of this.pendingDocs) {
      if (
        this.currentBlockNumber - doc.blockNumber <
        this.BLOCK_CONFIRMATIONS
      ) {
        // eslint-disable-next-line no-continue
        continue
      }
      // otherwise write
      try {
        logger.info(`Writing ${doc.collection}`)
        if (doc.operation === OperationType.CREATE) {
          await this.db.create(doc.collection, doc.create)
        } else if (doc.operation === OperationType.UPSERT) {
          await this.db.upsert(doc.collection, {
            where: doc.where,
            create: doc.create,
            update: doc.update,
          })
        } else if (doc.operation === OperationType.UPDATE) {
          await this.db.update(doc.collection, {
            where: doc.where,
            update: doc.update,
          })
        } else {
          throw new Error(`Unrecognized operation type: "${doc.operation}"`)
        }
        docsToRemove.push(doc)
      } catch (err) {
        console.log(`Error writing document`)
      }
    }
    this.pendingDocs = this.pendingDocs.filter(
      doc => docsToRemove.indexOf(doc) === -1,
    )
  }

  async upsertCache(
    collection: string,
    options: UpsertOptions,
    blockNumber: number,
    blockHash: string,
  ) {
    if (typeof blockNumber !== 'number')
      throw new Error('Invalid block number provided to BlockCache.upsertCache')
    const currentBlockNumber = await this.blockNumber()
    if (currentBlockNumber - blockNumber < this.BLOCK_CONFIRMATIONS) {
      // store in memory
      this.pendingDocs.push({
        blockNumber,
        blockHash,
        collection,
        operation: OperationType.UPSERT,
        ...options,
      })
      return
    }
    // otherwise create as usual
    await this.db.upsert(collection, options)
  }

  async updateCache(
    collection: string,
    options: UpdateOptions,
    blockNumber: number,
    blockHash: string,
  ) {
    if (typeof blockNumber !== 'number')
      throw new Error('Invalid block number provided to BlockCache.upsertCache')
    const currentBlockNumber = await this.blockNumber()
    if (currentBlockNumber - blockNumber < this.BLOCK_CONFIRMATIONS) {
      // store in memory
      this.pendingDocs.push({
        blockNumber,
        blockHash,
        collection,
        operation: OperationType.UPDATE,
        ...options,
      })
      return
    }
    // otherwise operate as usual
    await this.db.update(collection, options)
  }
}
