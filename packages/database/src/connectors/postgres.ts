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
  Relation,
} from '../types'
import {
  tableCreationSql,
  findManySql,
  createSql,
  deleteManySql,
  updateSql,
  countSql,
} from '../helpers/sql'

export class PostgresConnector implements DB {
  db: Client

  config: any | string

  schema: Schema = {}

  lock = new AsyncLock()

  constructor(config: any | string) {
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

  static async create(config: any | string) {
    const connector = new this(config)
    await connector.init()
    return connector
  }

  async create(collection: string, _doc: any) {
    const table = this.schema[collection]
    if (!table) throw new Error(`Unable to find table ${collection} in schema`)
    const docs = [_doc].flat()
    const { sql, query } = createSql(table, docs)
    await this.db.query(sql)
    if (Array.isArray(_doc)) {
      return this.findMany(collection, {
        where: query,
      })
    }
    return this.findOne(collection, {
      where: query,
    })
  }

  async findOne(collection: string, options: FindOneOptions) {
    const [obj] = await this.findMany(collection, {
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

  async findMany(collection: string, options: FindManyOptions) {
    const table = this.schema[collection]
    if (!table) throw new Error(`Unable to find table ${collection}`)
    const sql = findManySql(table, options)
    const { rows } = await this.db.query(sql)
    const objectKeys = Object.keys(table.rows).filter(key => {
      return table.rows[key]?.type === 'Object'
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
    await this.loadIncluded(collection, {
      models: rows,
      include,
    })
    return rows
  }

  async count(collection: string, where: WhereClause) {
    const table = this.schema[collection]
    if (!table) throw new Error(`Unable to find table ${collection}`)
    const sql = countSql(table, where)
    const { rows } = await this.db.query(sql)
    return +rows[0].count
  }

  async update(collection: string, options: UpdateOptions) {
    const { where, update } = options
    if (Object.keys(update).length === 0) return this.count(collection, where)
    const table = this.schema[collection]
    if (!table) throw new Error(`Unable to find table ${collection} in schema`)
    const sql = updateSql(table, options)
    const { rowCount } = await this.db.query(sql)
    return rowCount
  }

  async upsert(collection: string, options: UpsertOptions) {
    const { where, update, create } = options
    const updated = await this.update(collection, {
      where,
      update,
    })
    if (updated > 0) {
      const docs = await this.findMany(collection, {
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
    return this.create(collection, create)
  }

  async deleteOne(collection: string, options: FindOneOptions) {
    return this.deleteMany(collection, {
      ...options,
      limit: 1,
    })
  }

  async deleteMany(collection: string, options: DeleteManyOptions) {
    const table = this.schema[collection]
    if (!table) throw new Error(`Unable to find table "${collection}"`)
    const sql = deleteManySql(table, options)
    const result = await this.db.query(sql)
    return result.rowCount || 0
  }

  async ensureIndex(collection: string, name: string, keys: string[]) {
    console.log(this, collection, name, keys)
  }

  async createTables(tableData: TableData[]) {
    this.schema = constructSchema(tableData)
    const createTablesCommand = tableCreationSql(tableData)
    await this.db.query(createTablesCommand)
  }

  async close() {
    await this.db.end()
  }
}
