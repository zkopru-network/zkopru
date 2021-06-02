import { TransactionDB, DeleteManyOptions, DB, UpdateOptions, UpsertOptions, FindManyOptions } from './types'
import { validateDocuments } from './helpers/memory'
import uuid from 'uuid'
import AsyncLock from 'async-lock'

// if we have a cache transaction that is pending queue all other modifications to the collection afterword
// if the cached transaction is committed all changes up until the next uncommitted cached transaction should be committed

// if a cached transaction is committed after an uncommitted transaction consider this an error

export type CacheTransactionCommit = Function

export type MemoryCacheDB = {
  [collection: string]: {
    // the document, or null if it's been deleted
    [primaryKey: string]: any | null
  }
}

export class TransactionCache {
  db: DB

  // snapshots between cache transactions, can be incrementally applied
  transactionCaches = [] as MemoryCacheDB[]

  // cache transactions identifiers that have not been flushed to disk
  queuedTransactions = [] as string[]

  lock = new AsyncLock()

  constructor(db: DB) {
    this.db = db
    // The empty first cache state
    this.transactionCaches.push(this.emptyCache())
    // push a dummy identifier for a 0 diff change
    this.queuedTransactions.push(uuid.v4())
  }

  async cachedTransaction(
    operation: (db: TransactionDB) => void | Promise<void>
  ) {
    return this.lock.acquire('readwrite', () => this._cachedTransaction(operation))
  }

  async _cachedTransaction(
    operation: (db: TransactionDB) => void | Promise<void>
  ): Promise<string> {
    // execute these callbacks on cache commit, don't wait for disk flush
    const onCommitCallbacks = [] as Function[]
    const onErrorCallbacks = [] as Function[]
    const onCompleteCallbacks = [] as Function[]
    let start: Function | undefined
    let promise = new Promise(rs => {
      start = rs
    })
    // the cache transaction db object
    const db = {
      create: async (collection: string, docs: any | any[]) => {
        promise.then(() => this._create(collection, docs, true))
      },
      update: (collection: string, options: UpdateOptions) => {

      },
      upsert: (collection: string, options: UpsertOptions) => {

      },
      delete: (collection: string, options: DeleteManyOptions) => {
      },
      onCommit: (callback: Function) => {
        onCommitCallbacks.push(callback)
      },
      onError: (callback: Function) => {
        onErrorCallbacks.push(callback)
      },
      onComplete: (callback: Function) => {
        onCompleteCallbacks.push(callback)
      },
    }
    // first create the new snapshot
    const transactionId = uuid.v4()
    this.queuedTransactions.push(transactionId)
    this.transactionCaches.push(this.cloneLatestCache())
    try {
      // queue the db operations
      await Promise.resolve(operation(db))
      // then try to run the operations
      ;(start as Function)()
      await promise
      for (const cb of [...onCommitCallbacks, ...onCompleteCallbacks]) {
        cb()
      }
    } catch (err) {
      // if the operation fails wipe the transaction cache we just created
      this.queuedTransactions.pop()
      this.transactionCaches.pop()
      for (const cb of [...onErrorCallbacks, ...onCompleteCallbacks]) {
        cb()
      }
      throw err
    }
    return transactionId
  }

  cloneLatestCache() {
    const cache = {}
    for (const collection of Object.keys(this.latestCache)) {
      cache[collection] = {}
      for (const primaryKey of Object.keys(this.latestCache[collection])) {
        cache[collection][primaryKey] = this.latestCache[collection][primaryKey]
      }
    }
    return cache
  }

  get latestCache() {
    return this.transactionCaches[this.transactionCaches.length - 1]
  }

  emptyCache() {
    const cache = {}
    for (const collection of Object.keys(this.db.schema)) {
      cache[collection] = {}
    }
    return cache
  }

  async commitTransaction(transactionId: string) {
    // commit changes to disk and wipe cache snapshots
    const index = this.queuedTransactions.findIndex((id) => id === transactionId)
    if (index === -1) throw new Error(`Unrecognized transactionId ${transactionId}`)
    for (let x = 0; x <= index; x++) {
      // apply this snapshot to the DB
      // const cache = this.transactionCaches[x]
    }
    this.queuedTransactions = this.queuedTransactions.slice(index + 1)
    this.transactionCaches = this.transactionCaches.slice(index + 1)
    if (this.queuedTransactions.length === 0) {
      // insert an empty cache state
      this.transactionCaches.push(this.emptyCache())
      // push a dummy identifier for a 0 diff change
      this.queuedTransactions.push(uuid.v4())
    }
  }

  async applyCacheIndex(index: number) {
    for (const collection of Object.keys(this.transactionCaches[index])) {
      const cache = this.transactionCaches[index][collection]
      // apply this specific cache
    }
  }

  documentIdentifier(collection: string, doc: any) {
    const table = this.db.schema[collection]
    if (!table) {
      throw new Error(`Unknown collection ${collection}`)
    }
    const keys = [table.primaryKey].flat().map((key) => doc[key])
    return keys.join('-')
  }

  identifierPrimaryKeys(collection: string, identifier: string) {
    const table = this.db.schema[collection]
    if (!table) {
      throw new Error(`Unknown collection ${collection}`)
    }
    const primaryKeys = [table.primaryKey].flat()
    const values = identifier.split('-').map((value, index) => {
      const row = table.rowsByName[primaryKeys[index]]
      if (!row) throw new Error(`Bad row ${primaryKeys} ${index}`)
      if (row.type === 'Bool') {
        return !!value
      } else if (row.type === 'String') {
        return value
      } else if (row.type === 'Int') {
        return +value
      } else {
        return JSON.parse(value)
      }
    })
    const obj = {}
    for (let x = 0; x < primaryKeys.length; x++) {
      obj[primaryKeys[x]] = values[x]
    }
    return obj
  }

  async create(collection: string, docs: any | any[], forceCache = false) {
    return this.lock.acquire('readwrite', () => this._create(collection, docs, forceCache))
  }

  async _create(collection: string, docs: any | any[], forceCache = false) {
    const table = this.db.schema[collection]
    if (!table) {
      throw new Error(`Unknown collection ${collection}`)
    }
    const validatedDocuments = validateDocuments(table, docs)
    // now check to see if we're colliding with any other known documents
    for (const doc of validatedDocuments) {
      const identifier = this.documentIdentifier(collection, doc)
      if (this.latestCache[collection][identifier] === null) {
        // the document identifier has been deleted in cache and can be created
        continue
      } else if (this.latestCache[collection][identifier]) {
        // the document exists in the cache and thus we have a primary key collision
        throw new Error(`Document already exists`)
      } else if (this.latestCache[collection][identifier] === undefined) {
        // check the underlying database
        const primaryKeys = [table.primaryKey].flat()
        const existingCount = await this.db.count(collection, primaryKeys.reduce((acc, val) => {
          return {
            ...acc,
            [val]: doc[val],
          }
        }, {}))
        if (existingCount > 0) throw new Error(`Document already exists`)
      } else {
        throw new Error('Unexpected value in cache')
      }
    }
    // now create docs in memory we need to, e.g. if deleted in memory
    const docsForCreation = [] as any[]
    for (const doc of validatedDocuments) {
      const identifier = this.documentIdentifier(collection, doc)
      if (this.latestCache[collection][identifier] === null || forceCache) {
        this.latestCache[collection][identifier] = doc
      } else {
        docsForCreation.push(doc)
      }
    }
    // now create docs on disk we need to
    if (docsForCreation.length) {
      await this.db.create(collection, docsForCreation)
    }
    // return all docs - done
    return validatedDocuments
  }

  async findMany(
    collection: string,
    options: FindManyOptions,
  ) {
    return this.lock.acquire('read', () => this._findMany(collection, options))
  }

  async _findMany(
    collection: string,
    options: FindManyOptions,
  ) {
    // have to scan in memory and THEN query the actual DB
    const table = this.db.schema[collection]
    if (!table) {
      throw new Error(`Unknown collection ${collection}`)
    }
    const matchedCacheDocs = [] as any[]
    const deletedCacheClauses = {} as { [key: string]: object[] }
    for (const identifier of Object.keys(this.latestCache[collection])) {
      const doc = this.latestCache[collection][identifier]
      if (doc !== undefined) {
        // nothing to match
        const primaryKeyValues = this.identifierPrimaryKeys(collection, identifier)
        for (const key of Object.keys(primaryKeyValues)) {
          deletedCacheClauses[key] = [...(deletedCacheClauses[key] || []), { ne: primaryKeyValues[key] }]
        }
      }
      if (doc) {
        // potentially include this cache doc in the results
        matchedCacheDocs.push(doc)
      }
    }
    // construct a query using the deleted cache clause, then insert matched docs where appropriate
    const where = {
      ...options.where,
    }
    for (const key of Object.keys(deletedCacheClauses)) {
      if (Array.isArray(where[key])) {
        where[key].push(...deletedCacheClauses[key])
      } else if (typeof where[key] === undefined) {
        where[key] = deletedCacheClauses[key]
      } else {
        where[key] = [where[key], ...deletedCacheClauses[key]]
      }
    }
    // where is ready
    const found = await this.db.findMany(collection, {
      ...options,
      where,
    })
    if (matchedCacheDocs.length === 0) {
      return found
    }
    // otherwise insert where appropriate based on orderBy and then limit
    const allFound = [...found, ...matchedCacheDocs]
    if (options.orderBy) {
      allFound.sort((a, b) => {
        let sum = 0
        for (const key of Object.keys(options.orderBy || {})) {
          const ascending = (options.orderBy || {})[key] === 'asc'

        }
      })
    }
    return allFound.slice(0, options.limit)
  }
}
