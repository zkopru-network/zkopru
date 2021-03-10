/* eslint-disable no-underscore-dangle */
import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import AsyncLock from 'async-lock'
import {
  DB,
  WhereClause,
  DeleteManyOptions,
  FindManyOptions,
  FindOneOptions,
  UpdateOptions,
  UpsertOptions,
  TableData,
  // normalizeRowDef,
  constructSchema,
  Schema,
  Relation,
} from '../types'
import {
  // escapeQuotes,
  whereToSql,
  tableCreationSql,
  parseType,
} from '../helpers/sql'

export class SQLiteConnector implements DB {
  db: any // Database<sqlite3.Database, sqlite3.Statement>

  config: {
    filename: string
  } & any

  schema: Schema = {}

  lock = new AsyncLock()

  constructor(config: any /* ISqlite.Config */) {
    this.config = config
    this.db = {} as any
  }

  async init() {
    this.db = await open(this.config)
  }

  static async create(_config: any /* ISqlite.Config */ | string) {
    const config =
      typeof _config === 'string'
        ? {
            filename: _config,
            driver: sqlite3.Database,
          }
        : _config
    const connector = new this(config)
    await connector.init()
    return connector
  }

  async create(collection: string, _doc: any | any): Promise<any> {
    return this.lock.acquire('db', async () => this._create(collection, _doc))
  }

  private async _create(collection: string, _doc: any | any): Promise<any> {
    const table = this.schema[collection]
    if (!table) throw new Error(`Unable to find table ${collection} in schema`)
    // create defaults where needed
    const docs = [_doc].flat()
    for (const [, row] of Object.entries(table.rows)) {
      for (const doc of docs) {
        if (
          !row?.default ||
          (doc[row.name] !== undefined && doc[row.name] !== null)
        )
          // eslint-disable-next-line no-continue
          continue
        // otherwise generate default field
        Object.assign(doc, {
          [row.name]:
            typeof row.default === 'function' ? row.default() : row.default,
        })
      }
    }
    // generate keys using first document
    const allKeys = [] as string[]
    for (const doc of docs) {
      allKeys.push(...Object.keys(doc))
    }
    const keys = [] as string[]
    for (const key of allKeys) {
      // eslint-disable-next-line no-continue
      if (keys.indexOf(key) !== -1) continue
      keys.push(key)
    }
    // query for retrieving the created documents, uses IN operator for all
    // primary keys
    const uniqueKeys = keys.filter(k => table.rows[k]?.unique)
    const query = [table.primaryKey, uniqueKeys].flat().reduce((acc, key) => {
      if (key === undefined) return acc
      return {
        ...acc,
        [key]: [],
      }
    }, {})
    const keyString = keys.map(k => `"${k}"`).join(',')
    const allValues = [] as string[]
    for (const doc of docs) {
      const values = keys
        .map(k => {
          const rowDef = table.rows[k]
          if (!rowDef)
            throw new Error(`Unable to find row definition for key: "${k}"`)
          if (query[k]) {
            query[k].push(doc[k])
          }
          return parseType(rowDef.type, doc[k])
        })
        .join(',')
      allValues.push(`(${values})`)
    }
    const sql = `INSERT INTO "${collection}" (${keyString}) VALUES ${allValues.join(
      ', ',
    )};`
    const { changes } = await this.db.run(sql)
    if (changes !== docs.length) {
      throw new Error('Failed to create document')
    }
    if (Array.isArray(_doc)) {
      return this._findMany(collection, {
        where: query,
      })
    }
    return this._findOne(collection, {
      where: query,
    })
  }

  async findOne(collection: string, options: FindOneOptions) {
    return this.lock.acquire('db', async () =>
      this._findOne(collection, options),
    )
  }

  async _findOne(collection: string, options: FindOneOptions) {
    const [obj] = await this._findMany(collection, {
      ...options,
      limit: 1,
    })
    return obj === undefined ? null : obj
  }

  // load related models
  async loadIncluded(
    collection: string,
    options: { models: any[]; include?: any },
  ) {
    const { models, include } = options
    if (!include) return
    const table = this.schema[collection]
    if (!table) throw new Error(`Unable to find table ${collection} in schema`)
    for (const key of Object.keys(include)) {
      // for each relation to include
      const relation = table.relations[key]
      if (!relation)
        throw new Error(`Unable to find relation ${key} in ${collection}`)
      if (include[key]) {
        await this.loadIncludedModels(
          models,
          relation,
          typeof include[key] === 'object' ? include[key] : undefined,
        )
      }
    }
  }

  // load and assign submodels, mutates the models array supplied
  private async loadIncludedModels(
    models: any[],
    relation: Relation & { name: string },
    include?: any,
  ) {
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
    return this.lock.acquire('db', async () =>
      this._findMany(collection, options),
    )
  }

  async _findMany(collection: string, options: FindManyOptions) {
    const { where, include } = options
    const orderBy =
      options.orderBy && Object.keys(options.orderBy).length > 0
        ? ` ORDER BY ${Object.keys(options.orderBy)
            .map(key => {
              const val = (options.orderBy || {})[key]
              return `"${key}" ${val.toUpperCase()}`
            })
            .join(', ')}`
        : ''
    const limit = options.limit ? ` LIMIT ${options.limit} ` : ''
    const table = this.schema[collection]
    if (!table) throw new Error(`Unable to find table ${collection}`)
    const sql = `SELECT * FROM "${collection}" ${whereToSql(
      table,
      where,
    )} ${orderBy} ${limit};`
    const models = await this.db.all(sql)
    const objectKeys = Object.keys(table.rows).filter(key => {
      return table.rows[key]?.type === 'Object'
    })
    if (objectKeys.length > 0) {
      // need to expand json objects
      // nested yuck!
      // TODO handle json parse errors
      for (const model of models) {
        for (const key of objectKeys) {
          // eslint-disable-next-line no-continue
          if (typeof model[key] !== 'string') continue
          Object.assign(model, {
            [key]: JSON.parse(model[key]),
          })
        }
      }
    }
    await this.loadIncluded(collection, {
      models,
      include,
    })
    return models
  }

  async count(collection: string, where: WhereClause) {
    return this.lock.acquire('db', async () => this._count(collection, where))
  }

  async _count(collection: string, where: WhereClause) {
    const table = this.schema[collection]
    if (!table) throw new Error(`Unable to find table ${collection}`)
    const sql = `SELECT COUNT(*) FROM "${collection}" ${whereToSql(
      table,
      where,
    )};`
    const result = await this.db.get(sql)
    return result['COUNT(*)']
  }

  async update(collection: string, options: UpdateOptions) {
    return this.lock.acquire('db', async () =>
      this._update(collection, options),
    )
  }

  private async _update(collection: string, options: UpdateOptions) {
    const { where, update } = options
    if (Object.keys(update).length === 0) return this._count(collection, where)
    const table = this.schema[collection]
    if (!table) throw new Error(`Unable to find table ${collection} in schema`)
    const setSql = Object.keys(update)
      .map(key => {
        const rowDef = table.rows[key]
        if (!rowDef)
          throw new Error(`Unable to find row definition for key: "${key}"`)
        return `"${key}" = ${parseType(rowDef.type, update[key])}`
      })
      .join(', ')
    const sql = `UPDATE "${collection}" SET ${setSql} ${whereToSql(
      table,
      where,
    )}`
    const result = await this.db.run(sql)
    return result.changes || 0
  }

  async upsert(collection: string, options: UpsertOptions) {
    return this.lock.acquire('db', async () =>
      this._upsert(collection, options),
    )
  }

  async _upsert(collection: string, options: UpsertOptions) {
    const { where, update, create } = options
    const updated = await this._update(collection, {
      where,
      update,
    })
    if (updated > 0) {
      const docs = await this._findMany(collection, {
        where: {
          ...where,
          ...update,
        },
      })
      if (docs.length === 1) {
        return docs[0]
      }
      return docs
    }
    return this._create(collection, create)
  }

  async deleteOne(collection: string, options: FindOneOptions) {
    return this.deleteMany(collection, {
      ...options,
      limit: 1,
    })
  }

  async deleteMany(collection: string, options: DeleteManyOptions) {
    return this.lock.acquire('db', async () =>
      this._deleteMany(collection, options),
    )
  }

  private async _deleteMany(collection: string, options: DeleteManyOptions) {
    const table = this.schema[collection]
    if (!table) throw new Error(`Unable to find table "${collection}"`)
    const orderBySql =
      options.orderBy && Object.keys(options.orderBy).length > 0
        ? ` ORDER BY ${Object.keys(options.orderBy)
            .map(key => {
              const val = (options.orderBy || {})[key]
              return `"${key}" ${val.toUpperCase()}`
            })
            .join(', ')}`
        : ''
    const limitSql =
      options.limit === undefined ? '' : ` LIMIT ${options.limit} `
    const sql = `DELETE FROM "${collection}" WHERE "${table.primaryKey}" =
    (SELECT "${table.primaryKey}" FROM "${collection}" ${whereToSql(
      table,
      options.where,
    )} ${orderBySql} ${limitSql});`
    const { changes } = await this.db.run(sql)
    return changes || 0
  }

  async close() {
    await this.db.close()
  }

  // TODO
  async ensureIndex(collection: string, name: string, keys: string[]) {
    console.log(this, collection, name, keys)
  }

  async createTables(tableData: TableData[]) {
    this.schema = constructSchema(tableData)
    const createTablesCommand = tableCreationSql(tableData)
    await this.db.exec(createTablesCommand)
  }
}
