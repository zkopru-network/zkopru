export type WhereClause = { [key: string]: any }

export type FindManyOptions = {
  orderBy?: {
    [key: string]: 'asc' | 'desc'
  }
  take?: number
}

type DataType = 'Int' | 'Bool' | 'String' | 'Object'

export type RowDef = {
  name: string
  unique?: boolean
  optional?: boolean
  type: DataType
  // relational fields should be virtual
  relation?: {
    localField: string
    foreignField: string
    foreignTable: string
  }
  default?: any | 'autoincrement'
}

export type ShortRowDef = [
  string,
  DataType,
  { optional?: boolean; unique?: boolean } | undefined,
]

export interface TableData {
  name: string
  primaryKey?: string | string[]
  rows: (RowDef | ShortRowDef)[]
}

export interface DBConnector {
  create: (collection: string, doc: Record<string, any>) => Promise<void>
  findOne: (
    collection: string,
    where: WhereClause,
  ) => Promise<Record<string, any>>
  // retrieve many documents matching a where clause
  findMany: (
    collection: string,
    where: WhereClause,
    options: FindManyOptions,
  ) => Promise<Record<string, any>[]>
  // count document matching a where clause
  count: (collection: string, where: WhereClause) => Promise<number>
  // update some documents returning the number updated
  update: (
    collection: string,
    where: WhereClause,
    changes: Record<string, any>,
  ) => Promise<number>
  // update or create some documents
  upsert: (
    collection: string,
    where: WhereClause,
    options: {
      update: Record<string, any>
      create: Record<string, any>
    },
  ) => Promise<{ created: number; updated: number }>
  // request that an index be created between some keys, if supported
  ensureIndex: (collection: string, name: string, keys: string[]) => void
  // provide a schema to connectors that need schema info
  createTables: (tableData: TableData[]) => Promise<void>
}

export function normalizeRowDef(row: RowDef | ShortRowDef): RowDef {
  if (Array.isArray(row)) {
    const [name, type, options] = row
    return {
      name,
      type,
      ...(options || {}),
    }
  }
  return row
}

export type Schema = {
  [tableKey: string]:
    | {
        [rowKey: string]: RowDef | undefined
      }
    | undefined
}

export function constructSchema(tables: TableData[]): Schema {
  const schema = {}
  for (const table of tables) {
    schema[table.name] = {}
    for (const row of table.rows) {
      const fullRow = normalizeRowDef(row)
      schema[table.name][fullRow.name] = fullRow
    }
  }
  return schema
}
