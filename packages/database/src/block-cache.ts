import { logger } from '@zkopru/utils'
import { Provider } from '@ethersproject/providers'
import {
  DB,
  UpsertOptions,
  UpdateOptions,
  DeleteManyOptions,
  TransactionDB,
} from './types'

// process block in memory, write to DB when confirmed by enough blocks

const DEFAULT_BLOCK_CONFIRMATIONS = 8

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
  onWrite?: () => void
}

export class BlockCache {
  provider: Provider

  db: DB

  pendingOperations = [] as PendingOperation[]

  currentBlockNumber = 0

  blockHeaderSubscription: any

  BLOCK_CONFIRMATIONS = +(
    process.env.BLOCK_CONFIRMATIONS ?? DEFAULT_BLOCK_CONFIRMATIONS
  )

  constructor(provider: Provider, db: DB) {
    this.provider = provider
    this.db = db
    this.provider.on('block', async (blockNumber: number) => {
      this.currentBlockNumber = blockNumber
      // write stuff if needed
      try {
        await this.writeChangesIfNeeded()
      } catch (err) {
        logger.info(
          `database/block-cache - Error writing block cache changes: ${
            err instanceof Error ? err.message : 'unknown'
          }`,
        )
      }
    })
  }

  async blockNumber() {
    if (this.currentBlockNumber === 0) {
      // async load it
      this.currentBlockNumber = await this.provider.getBlockNumber()
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
    const docsToRemove: PendingOperation[] = []
    if (this.pendingOperations.length === 0) return
    for (const op of this.pendingOperations) {
      if (this.currentBlockNumber - op.blockNumber < this.BLOCK_CONFIRMATIONS) {
        // eslint-disable-next-line no-continue
        continue
      }
      // otherwise write
      try {
        logger.trace(`Writing ${op.collection}`)
        await this.writeChange(op)
        docsToRemove.push(op)
      } catch (err) {
        console.log(err)
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
    if (typeof operation.onWrite === 'function') {
      operation.onWrite()
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
    if (
      this.BLOCK_CONFIRMATIONS === 0 ||
      currentBlockNumber - blockNumber >= this.BLOCK_CONFIRMATIONS
    ) {
      await this.writeChange(pendingOperation)
    } else {
      // store in memory
      this.pendingOperations.push(pendingOperation)
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
    if (
      this.BLOCK_CONFIRMATIONS === 0 ||
      currentBlockNumber - blockNumber >= this.BLOCK_CONFIRMATIONS
    ) {
      await this.writeChange(pendingOperation)
    } else {
      // store in memory
      this.pendingOperations.push(pendingOperation)
    }
  }

  async transactionCache(
    operation: (db: TransactionDB) => void | Promise<void>,
    blockNumber: number,
    blockHash: string,
    onWrite?: () => void,
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
      onWrite,
    }
    if (
      this.BLOCK_CONFIRMATIONS === 0 ||
      currentBlockNumber - blockNumber >= this.BLOCK_CONFIRMATIONS
    ) {
      await this.writeChange(pendingOperation)
      if (typeof onWrite === 'function') onWrite()
    } else {
      this.pendingOperations.push(pendingOperation)
    }
  }
}
