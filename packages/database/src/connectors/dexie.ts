/* eslint-disable class-methods-use-this, no-underscore-dangle */
import AsyncLock from 'async-lock'
import Dexie from 'dexie'
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
  RowDef,
} from '../types'
import { loadIncluded } from '../helpers/shared'
import { execAndCallback } from '../helpers/callbacks'

export class DexieConnector extends DB {
  schema: Schema = {}

  lock = new AsyncLock({ maxPending: 100000 })

  db = new Dexie('zkopru')

  constructor(schema: Schema) {
    super()
    this.schema = schema
  }

  static async create(tables: TableData[]) {
    const schema = constructSchema(tables)
    const connector = new this(schema)
    const stores = Object.keys(schema).reduce((acc, name) => {
      const row = schema[name]
      const fields = row?.rows.map(r => {
        if (r.unique) {
          return `&${r.name}`
        }
        return r.name
      })
      const indexes = row?.indexes?.map(index => {
        if (index.keys.length <= 1) return
        return `[${index.keys.join('+')}]`
      }).filter(i => !!i)
      return {
        ...acc,
        [name]: [fields, indexes].flat().join(',')
      }
    }, {})
    connector.db.version(1).stores(stores)
    return connector
  }

  async create(collection: string, _doc: any) {
    const docs = [_doc].flat()
    const store = this.db[collection]
    if (!store) throw new Error(`Unable to find store "${collection}"`)
    const table = this.schema[collection]
    if (!table) throw new Error(`Unable to find table "${collection}"`)
    for (const doc of docs) {
      for (const row of (table.rows as RowDef[])) {
        if (!row.default || (doc[row.name] !== undefined && doc[row.name] !== null)) {
          continue
        }
        Object.assign(doc, {
          [row.name]:
            typeof row.default === 'function' ? row.default() : row.default,
        })
      }
    }
    await store.bulkAdd(docs)
  }

  async findOne(collection: string, options: FindOneOptions) {
    const result = await this.findMany(collection, {
      ...options,
      limit: 1,
    })
    if (result.length) return result[0]
    return null
  }

  async findMany(collection: string, options: FindManyOptions) {
    const { where, orderBy, include, limit } = options
    let query = this.buildQuery(collection, where)
    let models: any[]
    if (orderBy && Object.keys(orderBy).length === 1) {
      const key = Object.keys(orderBy)[0]
      models = await query.sortBy(key)
      if (orderBy[key] === 'desc') models = models.reverse()
      models = models.slice(0, limit)
    } else {
      if (limit) {
        query = query.limit(limit)
      }
      models = await query.toArray()
    }
    const table = this.schema[collection]
    if (!table) throw new Error(`Unable to find table ${collection}`)
    await loadIncluded(collection, {
      models,
      include,
      findMany: this.findMany.bind(this),
      table,
    })
    return models
  }

  async count(collection: string, where: WhereClause) {
    return this.buildQuery(collection, where).count()
  }

  async update(collection: string, options: UpdateOptions) {
    return this.buildQuery(collection, options.where).modify(options.update)
  }

  async upsert(collection: string, options: UpsertOptions) {
    const existingDocs = await this.count(collection, {
      where: options.where,
    })
    if (existingDocs === 0) {
      await this.create(collection, options.create)
    } else {
      return this.update(collection, {
        where: options.where,
        update: options.update,
      })
    }
  }

  async delete(collection: string, options: DeleteManyOptions) {
    return this.buildQuery(collection, options.where).delete()
  }

  async transaction(operation: (db: TransactionDB) => void, onComplete?: () => void) {
    let start: Function | undefined
    let promise = new Promise(rs => {
      start = rs
    })
    const onCommitCallbacks = [] as Function[]
    const onErrorCallbacks = [] as Function[]
    const onCompleteCallbacks = [] as Function[]
    if (onComplete) onCompleteCallbacks.push(onComplete)
    const db = {
      delete: (collection: string, options: DeleteManyOptions) => {
        promise = promise.then(() => this.delete(collection, options))
      },
      create: (collection: string, docs: any) => {
        promise = promise.then(() => this.create(collection, docs))
      },
      update: (collection: string, options: UpdateOptions) => {
        promise = promise.then(() => this.update(collection, options))
      },
      upsert: (collection: string, options: UpsertOptions) => {
        promise = promise.then(() => this.upsert(collection, options))
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
    await execAndCallback(
      async function(this: any) {
        await Promise.resolve(operation(db))
        // explicitly cast the start function because TS cannot determine that it's
        // set above. The body of a promise is executed sychronously so start will
        // be assigned at this point
        ;(start as Function)()
        await promise
      }.bind(this),
      {
        onError: onErrorCallbacks,
        onSuccess: onCommitCallbacks,
        onComplete: onCompleteCallbacks,
      },
    )
  }

  async close() {
    this.db.close()
  }

  private buildQuery(collection: string, where: WhereClause) {
    const store = this.db[collection]
    if (!store) throw new Error(`Unable to find store "${collection}"`)
    const storeCollection = store.toCollection()
    const topWhere = { ...where, OR: undefined, AND: undefined, }
    // choose a field to use as the primary filter, or choose and index
    // if it's possible to use an index, do, otherwise use one of the fields
    // in the following order: Integer, String, Boolean,
    const or = where.OR || []
    // const and = where.AND || []
    // let _query = storeCollection
    // const indexes = this.schema[collection]?.indexes || []
    // for (const index of indexes) {
    //   let useIndex = true
    //   for (const key of index.keys) {
    //     if (!topWhere[key] && topWhere[key] !== null && topWhere[key] !== '') {
    //       useIndex = false
    //       break
    //     }
    //   }
    //   if (!useIndex) continue
    //   // we found an index we can use
    //   _query.where(`[${index.keys.join('+')}]`)
    //   for (const key of index.keys) {
    //     if ()
    //   }
    // }
    // for (const key of Object.keys(topWhere)) {
    //   const val = topWhere[key]
    //
    //   // if (val)
    // }
    const applyQuery = (baseQuery, _where: WhereClause) => {
      let _baseQuery = baseQuery
      for (const key of Object.keys(_where)) {
        const val = _where[key]
        // eslint-disable-next-line no-continue
        if (val === undefined) continue
        if (Array.isArray(where[key])) {
          _baseQuery = _baseQuery.or(key).anyOf(val)
        } else if (val === null) {
          // need to use filter later
        } else if (typeof val !== 'object') {
          _baseQuery = _baseQuery.or(key).equals(val)
        }
        if (val.lt) {
          _baseQuery = _baseQuery.or(key).below(val.lt)
        }
        if (val.lte) {
          _baseQuery = _baseQuery.or(key).belowOrEqual(val.lte)
        }
        if (val.gt) {
          _baseQuery = _baseQuery.or(key).above(val.gt)
        }
        if (val.gte) {
          _baseQuery = _baseQuery.or(key).aboveOrEqual(val.gte)
        }
        if (val.nin) {
          _baseQuery = _baseQuery.or(key).noneOf(val.nin)
        }
        if (val.ne) {
          _baseQuery = _baseQuery.or(key).notEqual(val.ne)
        }
      }
      return _baseQuery
    }
    let query = applyQuery(storeCollection, topWhere)
    for (const orWhere of or) {
      query = applyQuery(query, orWhere)
    }
    // for (const andWhere of and) {
    //   query = applyQuery(query, andWhere, 'and')
    // }
    return query
  }
}
