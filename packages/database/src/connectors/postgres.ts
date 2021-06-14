/* eslint-disable no-underscore-dangle */
import { Client } from 'pg'
import AsyncLock from 'async-lock'
import {
  constructSchema,
  DB,
  Schema,
  FindOneOptions,
  FindManyOptions,
  WhereClause,
  UpdateOptions,
  UpsertOptions,
  DeleteManyOptions,
  TableData,
  TransactionDB,
} from '../types'
import {
  tableCreationSql,
  findManySql,
  createSql,
  deleteManySql,
  updateSql,
  countSql,
  upsertSql,
} from '../helpers/sql'
import { loadIncluded } from '../helpers/shared'

export class PostgresConnector extends DB {
  db: Client

  config: any | string

  schema: Schema = {}

  lock = new AsyncLock()

  constructor(config: any | string) {
    super()
    this.config = config
    this.db = {} as any
  }

  async init() {
    if (typeof this.config === 'string') {
      this.db = new Client({
        connectionString: this.config,
      })
    } else {
      this.db = new Client(this.config)
    }
    await this.db.connect()
  }

  static async create(tables: TableData[], config: any | string) {
    const connector = new this(config)
    await connector.init()
    await connector.createTables(tables)
    return connector
  }

  async create(collection: string, _doc: any) {
    return this.lock.acquire('write', async () =>
      this._create(collection, _doc),
    )
  }

  private async _create(collection: string, _doc: any) {
    const table = this.schema[collection]
    if (!table) throw new Error(`Unable to find table ${collection} in schema`)
    const docs = [_doc].flat()
    const { sql, query } = createSql(table, docs)
    await this.db.query(sql)
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

  private async _findOne(collection: string, options: FindOneOptions) {
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

  private async _findMany(collection: string, options: FindManyOptions) {
    const table = this.schema[collection]
    if (!table) throw new Error(`Unable to find table ${collection}`)
    const sql = findManySql(table, options)
    const { rows } = await this.db.query(sql)
    const objectKeys = Object.keys(table.rowsByName).filter(key => {
      return table.rowsByName[key]?.type === 'Object'
    })
    if (objectKeys.length > 0) {
      // need to expand json objects
      // nested yuck!
      // TODO handle json parse errors
      for (const model of rows) {
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
      models: rows,
      include,
      findMany: this._findMany.bind(this),
      table,
    })
    return rows
  }

  async count(collection: string, where: WhereClause) {
    return this.lock.acquire('read', async () => this._count(collection, where))
  }

  private async _count(collection: string, where: WhereClause) {
    const table = this.schema[collection]
    if (!table) throw new Error(`Unable to find table ${collection}`)
    const sql = countSql(table, where)
    const { rows } = await this.db.query(sql)
    return +rows[0].count
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
    const { rowCount } = await this.db.query(sql)
    return rowCount
  }

  async upsert(collection: string, options: UpsertOptions) {
    return this.lock.acquire('write', async () =>
      this._upsert(collection, options),
    )
  }

  private async _upsert(collection: string, options: UpsertOptions) {
    const table = this.schema[collection]
    if (!table) throw new Error(`Unable to find table ${collection} in schema`)
    const sql = upsertSql(table, options)
    const { rowCount } = await this.db.query(sql)
    return rowCount
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
    const result = await this.db.query(sql)
    return result.rowCount || 0
  }

  async createTables(tableData: TableData[]) {
    this.schema = constructSchema(tableData)
    const createTablesCommand = tableCreationSql(tableData)
    await this.db.query(createTablesCommand)
  }

  async transaction(operation: (db: TransactionDB) => void) {
    return this.lock.acquire('write', async () => this._transaction(operation))
  }

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
      await this.db.query(transactionSql)
      for (const cb of [...onCommitCallbacks, ...onCompleteCallbacks]) {
        cb()
      }
    } catch (err) {
      await this.db.query('ROLLBACK;')
      for (const cb of [...onErrorCallbacks, ...onCompleteCallbacks]) {
        cb()
      }
      throw err
    }
  }

  async close() {
    await this.db.end()
  }
}
