import Database from 'better-sqlite3'
import {
  DBConnector,
  WhereClause,
  FindManyOptions,
  TableData,
  normalizeRowDef,
} from '../types'

export default class SQLiteConnector implements DBConnector {
  db: Database
  constructor(dbPath: string, options: any) {
    this.db = new Database(dbPath, options)
  }

  async create(collection: string, doc: Object) {
    console.log(collection, doc)
    return {}
  }

  async findOne(collection: string, where: WhereClause) {
    console.log(collection, where)
    return {}
  }

  async findMany(collection: string, where: WhereClause, options: FindManyOptions) {
    console.log(collection, where, options)
    return []
  }

  async count(collection: string, where: WhereClause) {
    console.log(collection, where)
    return 0
  }

  async update(collection: string, where: WhereClause, changes: Object) {
    console.log(collection, where, changes)
    return 0
  }

  async upsert(collection: string, where: WhereClause, options: {
    update: Object,
    create: Object,
  }) {
    console.log(collection, where, options)
    return {
      created: 0,
      updated: 0,
    }
  }

  async ensureIndex(collection: string, name: string, keys: string[]) {
    console.log(collection, name, keys)
  }

  async createTables(tableData: TableData[]) {
    // run sql queries creating the tables as necessary
    for (const table of tableData) {
      const { name, primaryKey, rows } = table
      const typeMap = {
        'String': 'TEXT',
        'Int': 'INTEGER',
        'Bool': 'BOOLEAN',
        'Object': 'TEXT', // serialize via json in connector
      }
      const rowCommands = rows.map((row) => {
        const fullRow = normalizeRowDef(row)
        return `"${fullRow.name}" ${typeMap[fullRow.type]} ${fullRow.optional ? '' : 'NOT NULL'} ${fullRow.unique ? 'UNIQUE' : ''}`
      })
      const relationCommands = rows.map((row) => {
        const fullRow = normalizeRowDef(row)
        if (!fullRow.relation) return
        return `FOREIGN KEY ("${fullRow.relation.localField}")
          REFERENCES "${fullRow.relation.foreignTable}" ("${fullRow.relation.foreignField}")
            ON DELETE SET NULL
            ON UPDATE NO ACTION`
      }).filter((i) => !!i)
      if (primaryKey) {
        const primaryKeys = [primaryKey].flat().map((name: string) => `"${name}"`).join(',')
        relationCommands.push(`PRIMARY KEY (${primaryKeys})`)
      }
      // assume there's always at least 1 entry in rowCommands and relationCommands
      const sql = `CREATE TABLE IF NOT EXISTS ${name} (
        ${[rowCommands.join(','), relationCommands.join(',')].filter((i) => !!i).join(',')}
      );`
      this.db.prepare(sql).run()
    }
  }
}
