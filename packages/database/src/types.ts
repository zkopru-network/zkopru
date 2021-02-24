export type WhereClause = { [key: string]: any }

export type FindManyOptions = {
  orderBy?: {
    [key: string]: 'asc' | 'desc',
  },
  take?: number,
}

type DataType = 'Int' | 'Bool' | 'String' | 'Object'

export type RowDef = {
  name: string,
  unique?: boolean,
  optional?: boolean,
  type: DataType,
  // relational fields should be virtual
  relation?: {
    localField: string,
    foreignField: string,
    foreignTable: string,
  },
  default?: any | 'autoincrement',
}

export type ShortRowDef = [
  string,
  DataType,
  { optional?: boolean, unique?: boolean } | undefined
]

export interface TableData {
  name: string
  primaryKey?: string | string[]
  rows: (RowDef | ShortRowDef)[]
}

export interface DBConnector {
  create: (collection: string, doc: Object) => Promise<Object>
  findOne: (collection: string, where: WhereClause) => Promise<Object>
  // retrieve many documents matching a where clause
  findMany: (collection: string, where: WhereClause, options: FindManyOptions) => Promise<Object[]>
  // count document matching a where clause
  count: (collection: string, where: WhereClause) => Promise<number>
  // update some documents returning the number updated
  update: (collection: string, where: WhereClause, changes: Object) => Promise<number>
  // update or create some documents
  upsert: (collection: string, where: WhereClause, options: {
    update: Object,
    create: Object,
  }) => Promise<{ created: number, updated: number }>
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
