import sqlite3 from 'sqlite3'
import { open, Database, ISqlite } from 'sqlite'
import {
  DBConnector,
  WhereClause,
  FindManyOptions,
  TableData,
  normalizeRowDef,
  constructSchema,
  Schema,
} from '../types'

const escapeQuotes = (str: string) => str.replace(/"/gm, '""')

export default class SQLiteConnector implements DBConnector {
  db: Database<sqlite3.Database, sqlite3.Statement>

  config: {
    filename: string
  } & any

  schema: Schema = {}

  constructor(config: ISqlite.Config) {
    this.config = config
    this.db = {} as any
  }

  async init() {
    this.db = await open(this.config)
  }

  static async create(_config: ISqlite.Config | string) {
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

  whereToSql(collection: string, doc: Record<string, any>, joinWith = '=') {
    if (Object.keys(doc).length === 0) return ''
    const sql = Object.keys(doc)
      .map(key => {
        const rowDef = (this.schema[collection] || {})[key]
        if (!rowDef)
          throw new Error(`Unable to find row definition for key: "${key}"`)
        const val = doc[key]
        if (rowDef.type === 'String') {
          return `"${key}" ${joinWith} "${escapeQuotes(val)}"`
        }
        if (rowDef.type === 'Int') {
          return `"${key}" ${joinWith} ${val}`
        }
        if (rowDef.type === 'Bool') {
          return `"${key}" ${joinWith} ${val ? 'true' : 'false'}`
        }
        if (rowDef.type === 'Object') {
          return `"${key}" ${joinWith} ${escapeQuotes(JSON.stringify(val))}`
        }
        throw new Error('Unknown row type')
      })
      .join(' AND ')
    return ` WHERE ${sql} `
  }

  async create(collection: string, doc: Record<string, any>) {
    const keys = Object.keys(doc)
      .map(k => `"${k}"`)
      .join(',')
    const values = Object.keys(doc)
      .map(k => {
        const rowDef = (this.schema[collection] || {})[k]
        if (!rowDef)
          throw new Error(`Unable to find row definition for key: "${k}"`)
        let val = doc[k]
        if (
          (val === undefined || val === null) &&
          typeof rowDef.default !== 'undefined'
        ) {
          val =
            typeof rowDef.default === 'function'
              ? rowDef.default()
              : rowDef.default
        }
        if (rowDef.type === 'Bool' && typeof val === 'boolean') {
          return val ? 'true' : 'false'
        }
        if (rowDef.type === 'String' && typeof val === 'string') {
          return `"${escapeQuotes(val)}"`
        }
        if (rowDef.type === 'Int' && typeof val === 'number') {
          return val
        }
        if (rowDef.type === 'Object' && typeof val === 'object') {
          return `"${escapeQuotes(JSON.stringify(val))}"`
        }
        return null
      })
      .join(',')
    const sql = `INSERT INTO "${collection}" (${keys}) VALUES (${values});`
    await this.db.exec(sql)
  }

  async findOne(collection: string, where: WhereClause) {
    const sql = `SELECT * FROM "${collection}" ${this.whereToSql(
      collection,
      where,
    )} LIMIT 1;`
    return this.db.get(sql)
  }

  async findMany(
    collection: string,
    where: WhereClause,
    options: FindManyOptions = {},
  ) {
    const orderBy = options.orderBy ? ` ORDER BY ${Object.keys(options.orderBy).map((key) => {
      const val = (options.orderBy || {})[key]
      return `"${key}" ${val.toUpperCase()}`
    }).join(', ')}` : ''
    const limit = options.take ? ` LIMIT ${options.take} ` : ''
    const sql = `SELECT * FROM "${collection}" ${this.whereToSql(
      collection,
      where,
    )} ${orderBy} ${limit};`
    return this.db.all(sql)
  }

  async count(collection: string, where: WhereClause) {
    const sql = `SELECT COUNT(*) FROM "${collection}" ${this.whereToSql(
      collection,
      where,
    )};`
    const result = await this.db.get(sql)
    return result['COUNT(*)']
  }

  async update(
    collection: string,
    where: WhereClause,
    changes: Record<string, any>,
  ) {
    const setSql = Object.keys(changes)
      .map(key => {
        const rowDef = (this.schema[collection] || {})[key]
        if (!rowDef)
          throw new Error(`Unable to find row definition for key: "${key}"`)
        const val = changes[key]
        if (rowDef.type === 'String') {
          return `"${key}" = "${escapeQuotes(val)}"`
        }
        if (rowDef.type === 'Int') {
          return `"${key}" = ${val}`
        }
        if (rowDef.type === 'Bool') {
          return `"${key}" = ${val ? 'true' : 'false'}`
        }
        if (rowDef.type === 'Object') {
          return `"${key}" = ${escapeQuotes(JSON.stringify(val))}`
        }
        throw new Error('Unknown row type')
      })
      .join(', ')
    const sql = `UPDATE "${collection}" SET ${setSql} ${this.whereToSql(
      collection,
      where,
    )}`
    const result = await this.db.run(sql)
    return result.changes || 0
  }

  async upsert(
    collection: string,
    where: WhereClause,
    options: {
      update: Record<string, any>
      create: Record<string, any>
    },
  ) {
    const updated = await this.update(collection, where, options.update)
    if (updated > 0) {
      return {
        updated,
        created: 0,
      }
    }
    await this.create(collection, options.create)
    return {
      created: 1,
      updated: 0,
    }
  }

  // TODO
  async ensureIndex(collection: string, name: string, keys: string[]) {
    console.log(this, collection, name, keys)
  }

  async createTables(tableData: TableData[]) {
    this.schema = constructSchema(tableData)
    // run sql queries creating the tables as necessary
    for (const table of tableData) {
      const { name, primaryKey, rows } = table
      const typeMap = {
        String: 'TEXT',
        Int: 'INTEGER',
        Bool: 'BOOLEAN',
        Object: 'TEXT', // serialize via json in connector
      }
      const rowCommands = rows.map(row => {
        const fullRow = normalizeRowDef(row)
        return `"${fullRow.name}" ${typeMap[fullRow.type]} ${
          fullRow.optional ? '' : 'NOT NULL'
        } ${fullRow.unique ? 'UNIQUE' : ''}`
      })
      const relationCommands = rows
        .map(row => {
          const fullRow = normalizeRowDef(row)
          if (!fullRow.relation) return
          return `FOREIGN KEY ("${fullRow.relation.localField}")
          REFERENCES "${fullRow.relation.foreignTable}" ("${fullRow.relation.foreignField}")
            ON DELETE SET NULL
            ON UPDATE NO ACTION`
        })
        .filter(i => !!i)
      if (primaryKey) {
        const primaryKeys = [primaryKey]
          .flat()
          .map((name: string) => `"${name}"`)
          .join(',')
        relationCommands.push(`PRIMARY KEY (${primaryKeys})`)
      }
      // assume there's always at least 1 entry in rowCommands and relationCommands
      const sql = `CREATE TABLE IF NOT EXISTS ${name} (
        ${[rowCommands.join(','), relationCommands.join(',')]
          .filter(i => !!i)
          .join(',')}
      );`
      await this.db.exec(sql)
    }
  }
}
