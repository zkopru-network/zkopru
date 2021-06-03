/* eslint-disable class-methods-use-this, no-underscore-dangle */
import AsyncLock from 'async-lock'
import { openDB, IDBPDatabase, IDBPTransaction } from 'idb'
import {
  DB,
  FindOneOptions,
  FindManyOptions,
  WhereClause,
  UpdateOptions,
  UpsertOptions,
  DeleteManyOptions,
  TableData,
  TransactionDB,
  Schema,
  constructSchema,
} from '../types'
import { validateDocuments, matchDocument } from '../helpers/memory'
import { loadIncluded } from '../helpers/shared'

const DB_NAME = 'zkopru'

export class IndexedDBConnector extends DB {
  db?: IDBPDatabase<any>

  schema: Schema = {}

  lock = new AsyncLock()

  constructor(schema: Schema) {
    super()
    this.schema = schema
  }

  static async create(tables: TableData[]) {
    const schema = constructSchema(tables)
    const connector = new this(schema)
    connector.db = await openDB(DB_NAME, 6, {
      /**
       * If an index is changed (e.g. same keys different "unique" value) the
       * index will not be updated. If such a case occurs the name should be
       * changed to force a new index to be created and the old index deleted
       * */
      async upgrade(db, _, __, tx) {
        for (const table of tables) {
          const indexes = (schema[table.name] || {}).indexes || []
          if (db.objectStoreNames.contains(table.name)) {
            // table exists, look for indexes we need to create
            for (const index of indexes) {
              if (tx.objectStore(table.name).indexNames.contains(index.name)) {
                // eslint-disable-next-line no-continue
                continue
              }
              // otherwise we need to create the index
              tx.objectStore(table.name).createIndex(index.name, index.keys, {
                unique: !!index.unique,
              })
            }
            // look for indexes we need to delete
            for (const indexName of tx.objectStore(table.name).indexNames) {
              if (indexes.find(({ name }) => name === indexName)) {
                // eslint-disable-next-line no-continue
                continue
              }
              // otherwise we need to delete the index
              tx.objectStore(table.name).deleteIndex(indexName.toString())
            }
          } else {
            // create table as usual
            const store = db.createObjectStore(table.name, {
              keyPath: table.primaryKey,
            })
            for (const index of indexes) {
              store.createIndex(index.name, index.keys, {
                unique: !!index.unique,
              })
            }
          }
        }
      },
    })
    return connector
  }

  async create(collection: string, _doc: any) {
    return this.lock.acquire('write', async () =>
      this._create(collection, _doc),
    )
  }

  async _create(
    collection: string,
    _doc: any,
    _tx?: IDBPTransaction<any, string[], 'readwrite'>,
  ) {
    const table = this.schema[collection]
    if (!table) throw new Error(`Invalid collection: "${collection}"`)
    const docs = validateDocuments(table, _doc)
    if (!this.db) throw new Error('DB is not initialized')
    const tx = _tx || this.db.transaction(collection, 'readwrite')
    const createPromises = docs.map(doc => {
      const store = tx.objectStore(collection)
      return store.add(doc)
    })
    if (!_tx) {
      await Promise.all([...createPromises, tx.done])
    }
    return docs.length === 1 ? docs[0] : docs
  }

  async findOne(collection: string, options: FindOneOptions) {
    const [obj] = await this.findMany(collection, {
      ...options,
      limit: 1,
    })
    return obj === undefined ? null : obj
  }

  async findMany(collection: string, options: FindManyOptions) {
    return this.lock.acquire('read', async () =>
      this._findMany(collection, options),
    )
  }

  async _findMany(
    collection: string,
    options: FindManyOptions,
    _tx?: IDBPTransaction<any, string[], 'readwrite' | 'readonly'>,
  ) {
    /**
     * Currently only queries for single values can be accelerated by index.
     * Many fields can be specified, but each may have only 1 value.
     *
     * TODO: gt, lt, exists, include operators
     * */
    if (!this.db) throw new Error('DB is not initialized')
    // scan if there's a complex query
    if (
      typeof options.orderBy === 'object' ||
      Object.keys(options.where).length === 0
    ) {
      return this.findUsingScan(collection, options, _tx)
    }
    for (const key of Object.keys(options.where)) {
      if (typeof options.where[key] === 'object') {
        return this.findUsingScan(collection, options, _tx)
      }
    }
    // otherwise look for an index containing all relevant keys
    const allKeys = [] as string[]
    const whereObjects = [options.where, ...(options.where.OR || [])]
    for (const where of whereObjects) {
      allKeys.push(...Object.keys(where))
    }
    const foundKeys = {}
    const keys = allKeys.filter(key => {
      if (key === 'OR') return false
      if (foundKeys[key]) return false
      foundKeys[key] = true
      return true
    })
    // keys is now a unique list of keys we need in an index
    const table = this.schema[collection]
    if (!table) throw new Error(`Invalid collection: "${collection}"`)
    // now let's look for an index to accelerate the query with
    for (const index of table.indexes || []) {
      // make sure each required key is in the index, and all index keys are present
      let useIndex = true
      for (const key of keys) {
        if (index.keys.indexOf(key) === -1) {
          useIndex = false
          break
        }
      }
      for (const key of index.keys) {
        if (keys.indexOf(key) === -1) {
          useIndex = false
          break
        }
      }
      if (!useIndex) {
        // eslint-disable-next-line no-continue
        continue
      }
      // use this index
      const tx = _tx || this.db.transaction(collection)
      const txIndex = tx.objectStore(collection).index(index.name)
      const query = index.keys.map(k => options.where[k])
      const result = await txIndex.getAll(query)
      const found = result.filter(i => !!i)
      await loadIncluded(collection, {
        models: found,
        include: options.include,
        findMany: this._findMany.bind(this),
        table,
      })
      return found
    }
    // no index supports the query, scan
    return this.findUsingScan(collection, options, _tx)
  }

  private async findUsingScan(
    collection: string,
    options: FindManyOptions,
    _tx?: IDBPTransaction<any, string[], 'readwrite' | 'readonly'>,
  ) {
    if (!this.db) throw new Error('DB is not initialized')
    const table = this.schema[collection]
    if (!table) throw new Error(`Invalid collection: "${collection}"`)
    const found = [] as any[]
    let cursor: any
    const tx = _tx || this.db.transaction(collection)
    if (Object.keys(options.orderBy || {}).length > 0) {
      const key = Object.keys(options.orderBy || {})[0]
      // find an index to use for ordering by
      let indexName: string | undefined
      for (const index of table.indexes || []) {
        if (index.keys.length === 1 && index.keys[0] === key) {
          indexName = index.name
          break
        }
      }
      if (!indexName)
        throw new Error(`Unable to find index for ordering by ${key}`)
      // use a cursor
      const direction = (options.orderBy || {})[key] === 'asc' ? 'next' : 'prev'
      const index = tx.objectStore(collection).index(indexName)
      cursor = await index.openCursor(null, direction)
    } else {
      cursor = await tx.objectStore(collection).openCursor()
    }
    const { where, limit } = options
    while (cursor) {
      if (typeof limit === 'number' && found.length >= limit) break
      const obj = cursor.value
      if (matchDocument(where, obj)) {
        found.push(obj)
      }
      cursor = await cursor.continue()
    }
    await loadIncluded(collection, {
      models: found,
      include: options.include,
      findMany: this._findMany.bind(this),
      table,
    })
    return found
  }

  async count(collection: string, where: WhereClause) {
    return (await this.findMany(collection, { where })).length
  }

  async update(collection: string, options: UpdateOptions) {
    return this.lock.acquire('write', async () =>
      this._update(collection, options),
    )
  }

  async _update(
    collection: string,
    options: UpdateOptions,
    _tx?: IDBPTransaction<any, string[], 'readwrite'>,
  ) {
    if (!this.db) throw new Error('DB is not initialized')
    const items = await this._findMany(
      collection,
      { where: options.where },
      _tx,
    )
    if (Object.keys(options.update).length === 0) return items.length
    const tx = _tx || this.db.transaction(collection, 'readwrite')
    const promises = [] as Promise<any>[]
    const table = this.schema[collection]
    if (!table) throw new Error('Table not found')
    for (const item of items) {
      const store = tx.objectStore(collection)
      store.put({
        ...item,
        ...options.update,
      })
    }
    if (!_tx) {
      await Promise.all([...promises, tx.done])
    }
    return items.length
  }

  async upsert(collection: string, options: UpsertOptions) {
    return this.lock.acquire('write', async () =>
      this._upsert(collection, options),
    )
  }

  async _upsert(
    collection: string,
    options: UpsertOptions,
    _tx?: IDBPTransaction<any, string[], 'readwrite'>,
  ) {
    const updated = await this._update(collection, options, _tx)
    if (updated > 0) {
      return Object.keys(options.update).length === 0 ? 0 : updated
    }
    const created = await this._create(collection, options.create, _tx)
    return Array.isArray(created) ? created.length : 1
  }

  async delete(collection: string, options: DeleteManyOptions) {
    return this.lock.acquire('write', async () =>
      this._delete(collection, options),
    )
  }

  async _delete(
    collection: string,
    options: DeleteManyOptions,
    _tx?: IDBPTransaction<any, string[], 'readwrite'>,
  ) {
    if (!this.db) throw new Error('DB is not initialized')
    const items = await this._findMany(
      collection,
      { where: options.where },
      _tx,
    )
    const tx = _tx || this.db.transaction(collection, 'readwrite')
    const promises = [] as Promise<any>[]
    const table = this.schema[collection]
    if (!table) throw new Error('Table not found')
    const store = tx.objectStore(collection)
    for (const item of items) {
      promises.push(
        store.delete(
          Array.isArray(table.primaryKey)
            ? table.primaryKey.map(k => item[k])
            : item[table.primaryKey],
        ),
      )
    }
    if (!_tx) {
      await Promise.all([...promises, tx.done])
    }
    return items.length
  }

  async transaction(operation: (db: TransactionDB) => void) {
    return this.lock.acquire('write', async () => this._transaction(operation))
  }

  async _transaction(operation: (db: TransactionDB) => void | Promise<void>) {
    if (!this.db) throw new Error('DB is not initialized')
    // create an array of stores that the operation will mutate
    const stores = [] as string[]
    let tx: IDBPTransaction<any, string[], 'readwrite'>
    // don't start the transaction until we know what stores to involve and have
    // created and set the tx object
    let start: Function | undefined
    let promise = new Promise(rs => {
      start = rs
    })
    const onCommitCallbacks = [] as Function[]
    const onErrorCallbacks = [] as Function[]
    const onCompleteCallbacks = [] as Function[]
    const db = {
      delete: (collection: string, options: DeleteManyOptions) => {
        stores.push(collection)
        promise = promise.then(() => this._delete(collection, options, tx))
      },
      create: (collection: string, docs: any) => {
        stores.push(collection)
        promise = promise.then(() => this._create(collection, docs, tx))
      },
      update: (collection: string, options: UpdateOptions) => {
        stores.push(collection)
        promise = promise.then(() => this._update(collection, options, tx))
      },
      upsert: (collection: string, options: UpsertOptions) => {
        stores.push(collection)
        promise = promise.then(() => this._upsert(collection, options, tx))
      },
      onCommit: (cb: Function) => {
        if (typeof cb !== 'function')
          throw new Error('Non-function onCommit callback supplied')
        onCommitCallbacks.push(cb)
      },
      onError: (cb: Function) => {
        if (typeof cb !== 'function')
          throw new Error('Non-function onError callback supplied')
        onErrorCallbacks.push(cb)
      },
      onComplete: (cb: Function) => {
        if (typeof cb !== 'function')
          throw new Error('Non-function onComplete callback supplied')
        onCompleteCallbacks.push(cb)
      },
    } as TransactionDB
    // Call the `operation` function to get a list of the stores that are going
    // to be accessed. Once that is done create the transaction and call the
    // start function to begin executing the transaction operations
    await Promise.resolve(operation(db))
    // no operations to commit
    if (!stores.length) return (start as Function)()
    // get a unique list of stores
    const storeNames = {}
    const storesUnique = stores.filter(store => {
      if (storeNames[store]) return false
      storeNames[store] = true
      return true
    })
    tx = this.db.transaction(storesUnique, 'readwrite')
    // explicitly cast the start function because TS cannot determine that it's
    // set above. The body of a promise is executed sychronously so start will
    // be assigned at this point
    try {
      ;(start as Function)()
      await Promise.all([promise, tx.done])
      for (const cb of [...onCommitCallbacks, ...onCompleteCallbacks]) {
        cb()
      }
    } catch (err) {
      for (const cb of [...onErrorCallbacks, ...onCompleteCallbacks]) {
        cb()
      }
      throw err
    }
  }

  async close() {
    if (!this.db) throw new Error('DB is not initialized')
    this.db.close()
  }
}
