import sqlite3 from 'sqlite3'
import { open, Database, ISqlite } from 'sqlite'
import {
  DBConnector,
  WhereClause,
  FindManyOptions,
  FindOneOptions,
  UpdateOptions,
  UpsertOptions,
  TableData,
  normalizeRowDef,
  constructSchema,
  Schema,
  Relation,
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
    const table = this.schema[collection]
    if (!table) throw new Error(`Unable to find table ${collection} in schema`)
    const parseType = (type: string, value: any) => {
      if (value === null) return 'NULL'
      if (type === 'String') {
        return `"${escapeQuotes(value)}"`
      } else if (type === 'Int') {
        return value
      } else if (type === 'Bool') {
        return value ? 'true' : 'false'
      } else if (type === 'Object') {
        return `"${escapeQuotes(JSON.stringify(value))}"`
      }
      throw new Error(`Unrecognized type ${type}`)
    }
    const sql = Object.keys(doc)
      .map(key => {
        const rowDef = table.rows[key]
        if (!rowDef)
          throw new Error(`Unable to find row definition for key: "${key}"`)
        const val = doc[key]
        if (Array.isArray(val)) {
          // need to generate an IN query
          const values = val.map((v) => parseType(rowDef.type, v))
          return `"${key}" IN (${values.join(',')})`
        } else {
          return `"${key}" ${joinWith} ${parseType(rowDef.type, val)}`
        }
      })
      .join(' AND ')
    return ` WHERE ${sql} `
  }

  async create(collection: string, doc: Record<string, any>) {
    const keys = Object.keys(doc)
      .map(k => `"${k}"`)
      .join(',')
    const table = this.schema[collection]
    if (!table) throw new Error(`Unable to find table ${collection} in schema`)
    const values = Object.keys(doc)
      .map(k => {
        const rowDef = table.rows[k]
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

  async findOne(collection: string, options: FindOneOptions) {
    // const sql = `SELECT * FROM "${collection}" ${this.whereToSql(
    //   collection,
    //   where,
    // )} LIMIT 1;`
    // return this.db.get(sql)
    const [obj] = await this.findMany(collection, {
      ...options,
      limit: 1,
    })
    return obj
  }

  // load related models
  async loadIncluded(collection: string, options: { models: Object[], include?: Object}) {
    console.log('loading included', collection)
    const { models, include } = options
    if (!include) return
    const table = this.schema[collection]
    if (!table) throw new Error(`Unable to find table ${collection} in schema`)
    for (const key of Object.keys(include)) {
      // for each relation to include
      const relation = table.relations[key]
      if (!relation) throw new Error(`Unable to find relation ${key} in ${collection}`)
      if (include[key]) {
        await this.loadIncludedModels(
          models,
          relation,
          typeof include[key] === 'object' ? include[key] : undefined
        )
      }
    }
  }

  // load and assign submodels, mutates the models array supplied
  private async loadIncludedModels(
    models: Object[],
    relation: (Relation & { name: string }),
    include?: Object
  ) {
    const values = models.map((model) => model[relation.localField])
    // load relevant submodels
    const submodels = await this.findMany(relation.foreignTable, {
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

  async findMany(
    collection: string,
    options: FindManyOptions
  ) {
    const { where, include } = options
    const orderBy = options.orderBy ? ` ORDER BY ${Object.keys(options.orderBy).map((key) => {
      const val = (options.orderBy || {})[key]
      return `"${key}" ${val.toUpperCase()}`
    }).join(', ')}` : ''
    const limit = options.limit ? ` LIMIT ${options.limit} ` : ''
    const sql = `SELECT * FROM "${collection}" ${this.whereToSql(
      collection,
      where,
    )} ${orderBy} ${limit};`
    const models = await this.db.all(sql)
    // TODO: expand Object types using JSON.parse
    await this.loadIncluded(collection, {
      models,
      include,
    })
    return models
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
    options: UpdateOptions,
  ) {
    const { where, update } = options
    const table = this.schema[collection]
    if (!table) throw new Error(`Unable to find table ${collection} in schema`)
    const setSql = Object.keys(update)
      .map(key => {
        const rowDef = table.rows[key]
        if (!rowDef)
          throw new Error(`Unable to find row definition for key: "${key}"`)
        const val = update[key]
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
    options: UpsertOptions
  ) {
    const { where, update, create } = options
    const updated = await this.update(collection, {
      where,
      update,
    })
    if (updated > 0) {
      return {
        updated,
        created: 0,
      }
    }
    await this.create(collection, create)
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
        // relations are virtual and assigned at load time
        if (fullRow.relation) return
        return `"${fullRow.name}" ${typeMap[fullRow.type]} ${
          fullRow.optional ? '' : 'NOT NULL'
        } ${fullRow.unique ? 'UNIQUE' : ''}`
      }).filter((i) => !!i)
      // Do i even need this if i'm loading manually????
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
