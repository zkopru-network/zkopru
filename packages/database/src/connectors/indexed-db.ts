/* eslint-disable class-methods-use-this, typescript-eslint/no-unused-vars */
import AsyncLock from 'async-lock'
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
  Relation,
  normalizeRowDef,
  constructSchema,
} from '../types'
import { openDB, IDBPDatabase } from 'idb'

const DB_NAME = 'zkopru'

export class IndexedDBConnector implements DB {
  db?: IDBPDatabase<any>
  schema: Schema = {}

  lock = new AsyncLock()

  constructor(schema: Schema) {
    this.schema = schema
  }

  static async create(tables: TableData[]) {
    const schema = constructSchema(tables)
    const connector = new this(schema)
    connector.db = await openDB(DB_NAME, 2, {
      upgrade(db, /*oldVersion, newVersion, transaction*/) {
        for (const table of tables) {
          const store = db.createObjectStore(table.name, {
            keyPath: table.primaryKey,
          })
          for (const row of table.rows) {
            const fullRow = normalizeRowDef(row)
            if (fullRow.unique || fullRow.index) {
              store.createIndex(fullRow.name, fullRow.name, { unique: !!fullRow.unique })
            }
          }
        }
      }
    })
    return connector
  }

  async create(collection: string, _doc: any) {
    return this.lock.acquire('db', async () => this._create(collection, _doc))
  }

  async _create(collection: string, _doc: any) {
    console.log(collection, _doc)
    const table = this.schema[collection]
    if (!table) throw new Error(`Invalid collection: "${collection}"`)
    const docs = [_doc].flat().map((doc) => {
      // insert defaults where needed
      const defaults = {}
      for (const key of Object.keys(table.rows)) {
        const row = table.rows[key]
        if (!row) throw new Error('Expected row to exist')
        if (!row.default || (doc[row.name] !== undefined && doc[row.name] !== null))
          // eslint-disable-next-line no-continue
          continue
        Object.assign(defaults, {
          [row.name]: typeof row.default === 'function' ? row.default() : row.default,
        })
        if (
          !row.optional &&
          (defaults[row.name] === undefined || defaults[row.name] === null) &&
          (doc[row.name] === undefined || doc[row.name] === null)
        )
          throw new Error(`NULL received for non-optional field "${row.name}"`)
      }
      return {
        ...defaults,
        ...doc,
      }
    })
    if (!this.db) throw new Error('DB is not initialized')
    const tx = this.db.transaction(collection, 'readwrite')
    await Promise.all([
      ...docs.map(doc => tx.store.add(doc)),
      tx.done,
    ])
    return docs
  }

  async findOne(collection: string, options: FindOneOptions) {
    const [obj] = await this.findMany(collection, {
      ...options,
      limit: 1,
    })
    return obj === undefined ? null : obj
  }

  async loadIncluded(collection: string, options: { models: any[], include?: any}) {
    const { models, include } = options
    if (!include) return
    const table = this.schema[collection]
    if (!table) throw new Error(`Unable to find table ${collection} in schema`)
    for (const key of Object.keys(include)) {
      const relation = table.relations[key]
      if (!relation) {
        throw new Error(`Unable to find relation ${key} in ${collection}`)
      }
      if (include[key]) {
        await this.loadIncludedModels(
          models,
          relation,
          typeof include[key] === 'object' ? include[key] : undefined
        )
      }
    }
  }

  private async loadIncludedModels(models: any[], relation: Relation & { name: string }, include?: any) {
    const values = models.map(model => model[relation.localField])
    // load relevant submodels
    const submodels = await this._findMany(relation.foreignTable, {
      where: {
        [relation.foreignField]: values,
      },
      include: include as any, // load subrelations if needed
    })
    // key the submodels by their relation field
    const keyedSubmodels = {}
    for (const submodel of submodels) {
      // assign to the models
      keyedSubmodels[submodel[relation.foreignField]] = submodel
    }
    // Assign submodel onto model
    for (const model of models) {
      const submodel = keyedSubmodels[model[relation.localField]]
      Object.assign(model, {
        [relation.name]: submodel,
      })
    }
  }

  async findMany(collection: string, options: FindManyOptions) {
    return this.lock.acquire('db', async () => this._findMany(collection, options))
  }

  async _findMany(collection: string, options: FindManyOptions) {
    if (!this.db) throw new Error('DB is not initialized')
    const found = [] as any[]
    let cursor: any
    if (Object.keys(options.orderBy || {}).length > 0) {
      // use a cursor
      const key = Object.keys(options.orderBy || {})[0]
      const direction = (options.orderBy || {})[key] === 'asc' ? 'next' : 'prev'
      console.log('loading index for', key)
      const index = this.db.transaction(collection).store.index(key)
      cursor = await index.openCursor(null, direction)
    } else {
      cursor = await this.db.transaction(collection).store.openCursor()
    }
    // TODO: index accelerated queries when possible
    const matchDoc = (where: WhereClause, doc: any) => {
      for (const [key, val] of Object.entries(where)) {
        if (typeof val === 'object' && !Array.isArray(val) && val !== null) {
          if (typeof val.ne !== 'undefined' && doc[key] === val.ne) {
            return false
          }
          if (typeof val.lt !== 'undefined' && doc[key] >= val.lt) {
            return false
          }
          if (typeof val.lte !== 'undefined' && doc[key] > val.lt) {
            return false
          }
          if (typeof val.gt !== 'undefined' && doc[key] <= val.lt) {
            return false
          }
          if (typeof val.gte !== 'undefined' && doc[key] < val.lt) {
            return false
          }
        } else if (Array.isArray(val)) {
          let exists = false
          for (const v of val) {
            if (v === null && typeof doc[key] === 'undefined') {
              exists = true
              break
            }
            if (doc[key] === v) {
              exists = true
              break
            }
          }
          if (!exists) return false
        } else if (val === null && typeof doc[key] !== 'undefined' && doc[key] !== null) {
          return false
        } else if (val !== null && doc[key] !== val) {
          return false
        }
      }
      return true
    }
    const { where, limit } = options
    while (cursor) {
      if (typeof limit === 'number' && found.length >= limit) break
      const obj = cursor.value
      const or = [where.OR, { ...where, OR: undefined }].flat()
      for (const _where of or) {
        // eslint-disable-next-line no-continue
        if (typeof _where === 'undefined') continue
        if (matchDoc(_where, obj)) {
          found.push(obj)
          break
        }
      }
      cursor = await cursor.continue()
    }
    await this.loadIncluded(collection, {
      models: found,
      include: options.include,
    })
    return found
  }

  async count(collection: string, where: WhereClause) {
    return (await this.findMany(collection, { where })).length
  }

  async update(collection: string, options: UpdateOptions) {
    return this.lock.acquire('db', async () => this._update(collection, options))
  }

  async _update(collection: string, options: UpdateOptions) {
    const items = await this._findMany(collection, { where: options.where })
    const tx = this.db?.transaction(collection, 'readwrite')
    const promises = [] as Promise<any>[]
    const table = this.schema[collection]
    if (!table) throw new Error('Table not found')
    for (const item of items) {
      console.log('updating')
      tx?.store.put({
        ...item,
        ...options.update,
      })
    }
    await Promise.all([
      ...promises,
      tx?.done,
    ])
    return items.length
  }

  async upsert(collection: string, options: UpsertOptions) {
    return this.lock.acquire('db', async () => this._upsert(collection, options))
  }

  async _upsert(collection: string, options: UpsertOptions) {
    const updated = await this._update(collection, options)
    if (updated > 0) return updated
    console.log(options.create)
    const created = await this._create(collection, options.create)
    return created.length
  }

  async delete(collection: string, options: DeleteManyOptions) {
    return this.lock.acquire('db', async () => this._delete(collection, options))
  }

  async _delete(collection: string, options: DeleteManyOptions) {
    const items = await this._findMany(collection, { where: options.where })
    const tx = this.db?.transaction(collection, 'readwrite')
    const promises = [] as Promise<any>[]
    const table = this.schema[collection]
    if (!table) throw new Error('Table not found')
    for (const item of items) {
      tx?.store.delete(Array.isArray(table.primaryKey) ? table.primaryKey.map(k => item[k]) : item[table.primaryKey || ''])
    }
    await Promise.all([
      ...promises,
      tx?.done,
    ])
    return items.length
  }

  async createTables() {}

  async transaction(operation: (db: TransactionDB) => void) {
    return this.lock.acquire('db', async () => this._transaction(operation))
  }

  async _transaction(operation: (db: TransactionDB) => void) {
    let promise = Promise.resolve<any>(null)
    const db = {
      delete: (...args) => {
        promise = promise.then(() => this._delete(...args))
      },
      create: (...args) => {
        promise = promise.then(() => this._create(...args))
      },
      update: (...args) => {
        promise = promise.then(() => this._update(...args))
      },
      upsert: (...args) => {
        promise = promise.then(() => this._upsert(...args))
      },
    } as TransactionDB
    await Promise.resolve(operation(db))
    await promise
  }

  async close() {
    this.db?.close()
  }
}
