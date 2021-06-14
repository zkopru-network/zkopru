import Web3 from 'web3'
import { logger } from '@zkopru/utils'
import {
  DB,
  UpsertOptions,
  UpdateOptions,
  DeleteManyOptions,
  TransactionDB,
} from './types'

// process block in memory, write to DB when confirmed by enough blocks

const DEFAULT_BLOCK_CONFIRMATIONS = 15

enum OperationType {
  UPSERT,
  CREATE,
  UPDATE,
  TRANSACTION,
  DELETE,
}

type TransactionOperation = {
  collection: string
  type: OperationType
  where?: any
  create?: any
  update?: any
}

type PendingOperation = {
  blockNumber: number
  blockHash: string
  collection: string
  type: OperationType
  where?: any
  create?: any
  update?: any
  transactionOperations?: TransactionOperation[]
}

export class BlockCache {
  web3: Web3

  db: DB

  pendingOperations = [] as PendingOperation[]

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
    this.pendingOperations = this.pendingOperations.filter(({ blockHash }) => {
      return blockHash !== hash
    })
  }

  // Write any data that is old enough to be considered confirmed
  async writeChangesIfNeeded() {
    const docsToRemove = [] as any[]
    for (const op of this.pendingOperations) {
      if (this.currentBlockNumber - op.blockNumber < this.BLOCK_CONFIRMATIONS) {
        // eslint-disable-next-line no-continue
        continue
      }
      // otherwise write
      try {
        logger.info(`Writing ${op.collection}`)
        await this.writeChange(op)
        docsToRemove.push(op)
      } catch (err) {
        console.log(`Error writing document`)
      }
    }
    this.pendingOperations = this.pendingOperations.filter(
      doc => docsToRemove.indexOf(doc) === -1,
    )
  }

  async writeChange(operation: PendingOperation) {
    if (operation.type === OperationType.CREATE) {
      await this.db.create(operation.collection, operation.create)
    } else if (operation.type === OperationType.UPSERT) {
      await this.db.upsert(operation.collection, {
        where: operation.where,
        create: operation.create,
        update: operation.update,
      })
    } else if (operation.type === OperationType.UPDATE) {
      await this.db.update(operation.collection, {
        where: operation.where,
        update: operation.update,
      })
    } else if (operation.type === OperationType.TRANSACTION) {
      await this.db.transaction(db => {
        if (!operation.transactionOperations) return
        for (const op of operation.transactionOperations) {
          if (op.type === OperationType.CREATE) {
            db.create(op.collection, op.create)
          } else if (op.type === OperationType.UPSERT) {
            db.upsert(op.collection, {
              where: op.where,
              create: op.create,
              update: op.update,
            })
          } else if (op.type === OperationType.UPDATE) {
            db.update(op.collection, {
              where: op.where,
              update: op.update,
            })
          } else if (op.type === OperationType.DELETE) {
            db.delete(op.collection, {
              where: op.where,
            })
          } else {
            throw new Error(
              `Unrecognized transaction operation type: "${op.type}"`,
            )
          }
        }
      })
    } else if (operation.type === OperationType.DELETE) {
      await this.db.delete(operation.collection, {
        where: operation.where,
      })
    } else {
      throw new Error(`Unrecognized operation type: "${operation.type}"`)
    }
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
    const pendingOperation = {
      blockNumber,
      blockHash,
      collection,
      type: OperationType.UPSERT,
      ...options,
    }
    if (currentBlockNumber - blockNumber < this.BLOCK_CONFIRMATIONS) {
      // store in memory
      this.pendingOperations.push(pendingOperation)
    } else {
      await this.writeChange(pendingOperation)
    }
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
    const pendingOperation = {
      blockNumber,
      blockHash,
      collection,
      type: OperationType.UPDATE,
      ...options,
    }
    if (currentBlockNumber - blockNumber < this.BLOCK_CONFIRMATIONS) {
      // store in memory
      this.pendingOperations.push(pendingOperation)
    } else {
      await this.writeChange(pendingOperation)
    }
  }

  async transactionCache(
    operation: (db: TransactionDB) => void | Promise<void>,
    blockNumber: number,
    blockHash: string,
  ) {
    if (typeof blockNumber !== 'number')
      throw new Error('Invalid block number provided to BlockCache.upsertCache')
    const currentBlockNumber = await this.blockNumber()
    // store in memory
    const operations = [] as TransactionOperation[]
    const db = {
      create: (collection: string, doc: any | any[]) => {
        operations.push({
          type: OperationType.CREATE,
          collection,
          create: doc,
        })
      },
      update: (collection: string, options: UpdateOptions) => {
        operations.push({
          type: OperationType.UPDATE,
          collection,
          ...options,
        })
      },
      upsert: (collection: string, options: UpsertOptions) => {
        operations.push({
          type: OperationType.UPSERT,
          collection,
          ...options,
        })
      },
      delete: (collection: string, options: DeleteManyOptions) => {
        operations.push({
          type: OperationType.DELETE,
          collection,
          ...options,
        })
      },
      onCommit: () => {
        throw new Error('Not supported')
      },
      onError: () => {
        throw new Error('Not supported')
      },
      onComplete: () => {
        throw new Error('Not supported')
      },
    }
    await Promise.resolve(operation(db))
    const pendingOperation = {
      blockNumber,
      blockHash,
      collection: '',
      type: OperationType.TRANSACTION,
      transactionOperations: operations,
    }
    if (currentBlockNumber - blockNumber < this.BLOCK_CONFIRMATIONS) {
      await this.writeChange(pendingOperation)
    } else {
      this.pendingOperations.push(pendingOperation)
    }
  }
}
