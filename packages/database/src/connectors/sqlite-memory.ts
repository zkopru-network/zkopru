/* eslint-disable no-underscore-dangle */
import initSqlJs from 'sql.js'
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
  TransactionDB,
} from '../types'
import {
  tableCreationSql,
  createSql,
  findManySql,
  countSql,
  updateSql,
  deleteManySql,
  upsertSql,
} from '../helpers/sql'
import { loadIncluded } from '../helpers/shared'

export class SQLiteMemoryConnector extends DB {
  db: any

  schema: Schema = {}

  lock = new AsyncLock()

  constructor() {
    super()
    this.db = {} as any
  }

  async init() {
    const SQL = await initSqlJs({
      // locateFile: (file: string) => `https://sql.js.org/dist/${file}`,
    })
    this.db = new SQL.Database()
  }

  static async create(tables: TableData[]) {
    const connector = new this()
    await connector.init()
    await connector.createTables(tables)
    return connector
  }

  async create(collection: string, _doc: any | any): Promise<any> {
    return this.lock.acquire('write', async () =>
      this._create(collection, _doc),
    )
  }

  private async _create(collection: string, _doc: any | any): Promise<any> {
    const table = this.schema[collection]
    if (!table) throw new Error(`Unable to find table ${collection} in schema`)
    const docs = [_doc].flat()
    const { sql, query } = createSql(table, docs)
    await this.db.exec(sql)
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
    return this.lock.acquire('read', async () =>
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

  async findMany(collection: string, options: FindManyOptions) {
    return this.lock.acquire('read', async () =>
      this._findMany(collection, options),
    )
  }

  async _findMany(collection: string, options: FindManyOptions) {
    const table = this.schema[collection]
    if (!table) throw new Error(`Unable to find table ${collection}`)
    const sql = findManySql(table, options)
    const result = await this.db.exec(sql)
    if (result.length === 0) return []
    const [{ columns, values }] = result
    const models = [] as any[]
    for (const value of values) {
      const obj = {}
      for (const [index, column] of Object.entries(columns)) {
        obj[column as string] = value[index]
      }
      models.push(obj)
    }
    const objectKeys = Object.keys(table.rowsByName).filter(key => {
      return table.rowsByName[key]?.type === 'Object'
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
    const { include } = options
    await loadIncluded(collection, {
      models,
      include,
      findMany: this._findMany.bind(this),
      table,
    })
    return models
  }

  async count(collection: string, where: WhereClause) {
    return this.lock.acquire('read', async () => this._count(collection, where))
  }

  async _count(collection: string, where: WhereClause) {
    const table = this.schema[collection]
    if (!table) throw new Error(`Unable to find table ${collection}`)
    const sql = countSql(table, where)
    const result = await this.db.exec(sql)
    return result[0].values[0][0]
  }

  async update(collection: string, options: UpdateOptions) {
    return this.lock.acquire('write', async () =>
      this._update(collection, options),
    )
  }

  private async _update(collection: string, options: UpdateOptions) {
    const { where, update } = options
    if (Object.keys(update).length === 0) return this._count(collection, where)
    const table = this.schema[collection]
    if (!table) throw new Error(`Unable to find table ${collection} in schema`)
    const sql = updateSql(table, options)
    await this.db.exec(sql)
    return this.db.getRowsModified()
  }

  async upsert(collection: string, options: UpsertOptions) {
    return this.lock.acquire('write', async () =>
      this._upsert(collection, options),
    )
  }

  async _upsert(collection: string, options: UpsertOptions) {
    const table = this.schema[collection]
    if (!table) throw new Error(`Unable to find table ${collection} in schema`)
    const sql = upsertSql(table, options)
    try {
      await this.db.run(sql)
      return this.db.getRowsModified()
    } catch (err) {
      console.log(sql)
      throw err
    }
  }

  async delete(collection: string, options: DeleteManyOptions) {
    return this.lock.acquire('write', async () =>
      this._deleteMany(collection, options),
    )
  }

  private async _deleteMany(collection: string, options: DeleteManyOptions) {
    const table = this.schema[collection]
    if (!table) throw new Error(`Unable to find table "${collection}"`)
    const sql = deleteManySql(table, options)
    await this.db.run(sql)
    return this.db.getRowsModified()
  }

  async transaction(operation: (db: TransactionDB) => void) {
    return this.lock.acquire('write', async () => this._transaction(operation))
  }

  // Allow only updates, upserts, deletes, and creates
  private async _transaction(operation: (db: TransactionDB) => void) {
    if (typeof operation !== 'function') throw new Error('Invalid operation')
    const sqlOperations = [] as string[]
    const onCommitCallbacks = [] as Function[]
    const onErrorCallbacks = [] as Function[]
    const onCompleteCallbacks = [] as Function[]
    const transactionDB = {
      create: (collection: string, _doc: any) => {
        const table = this.schema[collection]
        if (!table)
          throw new Error(`Unable to find table ${collection} in schema`)
        const docs = [_doc].flat()
        const { sql } = createSql(table, docs)
        sqlOperations.push(sql)
      },
      update: (collection: string, options: UpdateOptions) => {
        const table = this.schema[collection]
        if (!table)
          throw new Error(`Unable to find table ${collection} in schema`)
        sqlOperations.push(updateSql(table, options))
      },
      delete: (collection: string, options: DeleteManyOptions) => {
        const table = this.schema[collection]
        if (!table) throw new Error(`Unable to find table "${collection}"`)
        const sql = deleteManySql(table, options)
        sqlOperations.push(sql)
      },
      upsert: (collection: string, options: UpsertOptions) => {
        const table = this.schema[collection]
        if (!table) throw new Error(`Unable to find table "${collection}"`)
        const sql = upsertSql(table, options)
        sqlOperations.push(sql)
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
    }
    await Promise.resolve(operation(transactionDB))
    // now apply the transaction
    const transactionSql = `BEGIN TRANSACTION;
    ${sqlOperations.join('\n')}
    COMMIT;`
    try {
      await this.db.exec(transactionSql)
      for (const cb of [...onCommitCallbacks, ...onCompleteCallbacks]) {
        cb()
      }
    } catch (err) {
      await this.db.exec('ROLLBACK;')
      for (const cb of [...onErrorCallbacks, ...onCompleteCallbacks]) {
        cb()
      }
      throw err
    }
  }

  async close() {
    await this.db.close()
  }

  async createTables(tableData: TableData[]) {
    this.schema = constructSchema(tableData)
    const createTablesCommand = tableCreationSql(tableData)
    await this.db.exec(createTablesCommand)
  }
}
