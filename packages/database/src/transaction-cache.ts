/* eslint-disable no-underscore-dangle */
import * as uuid from 'uuid'
import AsyncLock from 'async-lock'
import {
  WhereClause,
  TransactionDB,
  DeleteManyOptions,
  DB,
  UpdateOptions,
  UpsertOptions,
  FindManyOptions,
  FindOneOptions,
} from './types'
import { validateDocuments, matchDocument } from './helpers/memory'
import { loadIncluded } from './helpers/shared'

// if we have a cache transaction that is pending queue all other modifications to the collection afterword
// if the cached transaction is committed all changes up until the next uncommitted cached transaction should be committed

// if a cached transaction after an uncommitted transaction is committed consider this an error

export type CacheTransactionCommit = Function

export type MemoryCacheDB = {
  [collection: string]: {
    // the document, or null if it's been deleted
    docs: { [primaryKey: string]: any | null }
    deleted: any[]
    // TODO: add indexes
  }
}

export default class TransactionCache {
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
    operation: (db: TransactionDB) => void | Promise<void>,
  ) {
    return this.lock.acquire('readwrite', () =>
      this._cachedTransaction(operation),
    )
  }

  async _cachedTransaction(
    operation: (db: TransactionDB) => void | Promise<void>,
  ): Promise<string> {
    // execute these callbacks on cache commit, don't wait for disk flush
    const onCommitCallbacks = [] as Function[]
    const onErrorCallbacks = [] as Function[]
    const onCompleteCallbacks = [] as Function[]
    let start: Function | undefined
    const promise = new Promise(rs => {
      start = rs
    })
    // the cache transaction db object
    const db = {
      create: async (collection: string, docs: any | any[]) => {
        promise.then(() => this._create(collection, docs, true))
      },
      update: (collection: string, options: UpdateOptions) => {
        promise.then(() => this._update(collection, options))
      },
      upsert: (collection: string, options: UpsertOptions) => {
        promise.then(() => this._upsert(collection, options))
      },
      delete: (collection: string, options: DeleteManyOptions) => {
        promise.then(() => this._delete(collection, options))
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
      for (const primaryKey of Object.keys(this.latestCache[collection].docs)) {
        cache[collection][primaryKey] = this.latestCache[collection].docs[
          primaryKey
        ]
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
      cache[collection] = {
        docs: {},
        deleted: [],
      }
    }
    return cache
  }

  tableForCollection(collection: string) {
    const table = this.db.schema[collection]
    if (!table) {
      throw new Error(`Unknown collection ${collection}`)
    }
    return table
  }

  async commitTransaction(transactionId: string) {
    // commit changes to disk and wipe cache snapshots
    const index = this.queuedTransactions.findIndex(id => id === transactionId)
    if (index === -1)
      throw new Error(`Unrecognized transactionId ${transactionId}`)
    for (let x = 0; x <= index; x += 1) {
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

  async rollbackTransaction(transactionId: string) {
    // roll back the changes in a specific snapshot and all snapshots after
    return transactionId
  }

  async applyCacheIndex(index: number) {
    for (const collection of Object.keys(this.transactionCaches[index])) {
      const cache = this.transactionCaches[index][collection]
      if (cache) {
      }
      // apply this specific cache
    }
  }

  // return an identifier for a single well formed document (must have all primary key values)
  documentIdentifier(collection: string, doc: any) {
    const table = this.tableForCollection(collection)
    const keys = [table.primaryKey].flat().map(key => {
      const value = doc[key]
      if (value === undefined)
        throw new Error(`Missing primary key field ${key}`)
      if (
        typeof value === 'object' &&
        value !== null &&
        table.rowsByName[key]?.type !== 'Object'
      )
        throw new Error(`Invalid value for field "${key}": ${value}`)
      return value
    })
    return keys.join('-')
  }

  identifierPrimaryKeys(collection: string, identifier: string) {
    const table = this.tableForCollection(collection)
    const primaryKeys = [table.primaryKey].flat()
    const values = identifier.split('-').map((value, index) => {
      const row = table.rowsByName[primaryKeys[index]]
      if (!row) throw new Error(`Bad row ${primaryKeys} ${index}`)
      if (row.type === 'Bool') {
        return !!value
      }
      if (row.type === 'String') {
        return value
      }
      if (row.type === 'Int') {
        return +value
      }
      return JSON.parse(value)
    })
    const obj = {}
    for (let x = 0; x < primaryKeys.length; x += 1) {
      obj[primaryKeys[x]] = values[x]
    }
    return obj
  }

  // primary keys _have_ to exist to perform this check
  existsInCache(collection: string, where: WhereClause) {
    const identifier = this.documentIdentifier(collection, where)
    if (this.latestCache[collection].docs[identifier] === null) {
      return true
    }
    if (this.latestCache[collection].docs[identifier]) {
      return true
    }
    return false
  }

  findInCache(collection: string, where: WhereClause) {
    const found = [] as any[]
    for (const key of Object.keys(this.latestCache[collection].docs)) {
      const doc = this.latestCache[collection].docs[key]
      // eslint-disable-next-line no-continue
      if (doc === null) continue
      if (matchDocument(where, doc)) found.push(doc)
    }
    return found
  }

  // Return documents that have been deleted matching the where clause?
  deletedInCache(collection: string, where: WhereClause) {
    const found = [] as any[]
    for (const doc of Object.keys(this.latestCache[collection].deleted)) {
      if (matchDocument(where, doc)) found.push(doc)
    }
    return found
  }

  // Take a where clause and modify it to exclude some documents
  modifyWhereClause(
    collection: string,
    where: WhereClause,
    docsToExclude: any[],
  ) {
    if (docsToExclude.length === 0) return where
    const table = this.tableForCollection(collection)
    // used to de-duplicate ne clauses
    const excludedIdentifiers = {} as { [key: string]: boolean }
    const primaryKeys = [table.primaryKey].flat()
    // a series of AND conditions
    const cacheIgnoreWhereClauses = [] as { [key: string]: any }[]
    for (const doc of docsToExclude) {
      const serializedKey = this.documentIdentifier(collection, doc)
      // eslint-disable-next-line no-continue
      if (excludedIdentifiers[serializedKey]) continue
      excludedIdentifiers[serializedKey] = true
      // add ne clauses
      const where = {}
      for (const key of primaryKeys) {
        where[key] = { ne: doc[key] }
      }
      cacheIgnoreWhereClauses.push(where)
    }
    // construct a query using the cache ignore where clauses
    return {
      AND: [where, ...cacheIgnoreWhereClauses],
    }
  }

  async create(collection: string, docs: any | any[], forceCache = false) {
    return this.lock.acquire('readwrite', () =>
      this._create(collection, docs, forceCache),
    )
  }

  async _create(collection: string, docs: any | any[], forceCache = false) {
    const table = this.tableForCollection(collection)
    const validatedDocuments = validateDocuments(table, docs)
    const orClauses = validatedDocuments.map((doc: any) => ({
      ...[table.primaryKey]
        .flat()
        .reduce((acc, key) => ({ ...acc, [key]: doc[key] }), {}),
    }))
    const where = { OR: orClauses }
    const docsInCache = this.findInCache(collection, where)
    if (docsInCache.length > 0) throw new Error(`Duplicate primary key`)
    const deletedInCache = this.deletedInCache(collection, where)
    // get a where clause to find any docs for our keys that haven't been
    // deleted in the cache
    const modifiedWhere = this.modifyWhereClause(
      collection,
      where,
      deletedInCache,
    )
    // now check to see if we're colliding with any other known documents
    // TODO: deal with unique field constraints
    const count = await this.db.count(collection, modifiedWhere)
    if (count !== 0) throw new Error(`Duplicate primary key`)
    // now create docs in memory we need to, e.g. if deleted in memory
    const docsForCreation = [] as any[]
    for (const doc of validatedDocuments) {
      const identifier = this.documentIdentifier(collection, doc)
      if (
        this.latestCache[collection].docs[identifier] === null ||
        forceCache
      ) {
        this.latestCache[collection].docs[identifier] = doc
      } else {
        docsForCreation.push(doc)
      }
    }
    // now create docs on disk we need to
    if (docsForCreation.length) {
      await this.db.create(collection, docsForCreation)
    }
    // return all docs
    if (validatedDocuments.length === 1) {
      return validatedDocuments.pop()
    }
    return validatedDocuments
  }

  async findOne(collection: string, options: FindOneOptions) {
    const [obj] = await this.findMany(collection, {
      ...options,
      limit: 1,
    })
    return obj === undefined ? null : obj
  }

  async findMany(collection: string, options: FindManyOptions) {
    return this.lock.acquire('read', () => this._findMany(collection, options))
  }

  async _findMany(collection: string, options: FindManyOptions) {
    // have to scan in memory and THEN query the actual DB
    const table = this.tableForCollection(collection)
    const cacheDocs = this.findInCache(collection, options.where)
    const deletedCacheDocs = this.deletedInCache(collection, options.where)

    const finalWhere = this.modifyWhereClause(collection, options.where, [
      ...cacheDocs,
      ...deletedCacheDocs,
    ])
    const found = await this.db.findMany(collection, {
      ...options,
      where: finalWhere,
    })
    if (cacheDocs.length === 0) {
      return found
    }
    // otherwise insert where appropriate based on orderBy and then limit
    const allFound = [...found, ...cacheDocs]
    if (options.orderBy) {
      allFound.sort((a, b) => {
        const keys = Object.keys(options.orderBy || {})
        for (const key of keys) {
          const ascending = (options.orderBy || {})[key] === 'asc'
          if (b[key] > a[key]) {
            return ascending ? -1 : 1
          }
          if (b[key] < a[key]) {
            return ascending ? 1 : -1
          }
        }
        return 0
      })
    }
    const final = allFound.slice(0, options.limit)
    // load related models
    await loadIncluded(collection, {
      models: final,
      include: options.include,
      findMany: this._findMany.bind(this),
      table,
    })
    return final
  }

  async count(collection: string, where: WhereClause) {
    return (await this.findMany(collection, { where })).length
  }

  async update(collection: string, options: UpdateOptions) {
    return this.lock.acquire('readwrite', () =>
      this._update(collection, options),
    )
  }

  async _update(collection: string, options: UpdateOptions) {
    const docsInCache = this.findInCache(collection, options.where)
    const deleted = this.deletedInCache(collection, options.where)
    const where = this.modifyWhereClause(collection, options.where, [
      ...docsInCache,
      ...deleted,
    ])
    // exclude these docs ^ from update
    // TODO: validate unique fields constraints
    // if the update operation succeeds then modify in cache
    const updated = await this.db.update(collection, {
      ...options,
      where, // update using AND operator to exclude certain docs
    })
    // now modify in cache
    for (const doc of docsInCache) {
      const identifier = this.documentIdentifier(collection, doc)
      for (const key of Object.keys(options.update)) {
        this.latestCache[collection].docs[identifier][key] = options.update[key]
      }
    }
    return updated + docsInCache.length
  }

  async delete(collection: string, options: DeleteManyOptions) {
    return this.lock.acquire('readwrite', () =>
      this._delete(collection, options),
    )
  }

  async _delete(collection: string, options: DeleteManyOptions) {
    const docsInCache = this.findInCache(collection, options.where)
    const deleted = this.deletedInCache(collection, options.where)
    const where = this.modifyWhereClause(collection, options.where, [
      ...docsInCache,
      ...deleted,
    ])
    const deletedCount = await this.db.delete(collection, {
      ...options,
      where,
    })
    // now modify the cache
    for (const doc of docsInCache) {
      const identifier = this.documentIdentifier(collection, doc)
      this.latestCache[collection].deleted.push(doc)
      this.latestCache[collection].docs[identifier] = null
    }
    return deletedCount + docsInCache.length
  }

  async upsert(collection: string, options: UpsertOptions) {
    return this.lock.acquire('readwrite', () =>
      this._upsert(collection, options),
    )
  }

  async _upsert(collection: string, options: UpsertOptions) {
    const updated = await this._update(collection, options)
    if (updated > 0) {
      return Object.keys(options.update).length === 0 ? 0 : updated
    }
    const created = await this._create(collection, options.create)
    return Array.isArray(created) ? created.length : 1
  }

  async close() {
    await this.db.close()
  }
}
