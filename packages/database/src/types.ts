export type WhereClause = { [key: string]: any }

export type FindManyOptions = {
  where: WhereClause
  orderBy?: {
    [key: string]: 'asc' | 'desc'
  }
  include?: {
    [key: string]: boolean | Record<string, any>
  }
  limit?: number
}

export type FindOneOptions = {
  where: WhereClause
  orderBy?: {
    [key: string]: 'asc' | 'desc'
  }
}

export type DeleteManyOptions = {
  where: WhereClause
  orderBy?: {
    [key: string]: 'asc' | 'desc'
  }
  limit?: number
}

export type UpdateOptions = {
  where: WhereClause
  update: Record<string, any>
}

export type UpsertOptions = {
  where: WhereClause
  update: Record<string, any>
  create: Record<string, any>
}

export type DataType = 'Int' | 'Bool' | 'String' | 'Object'

export type Relation = {
  localField: string
  foreignField: string
  foreignTable: string
}

export type RowDef = {
  name: string
  unique?: boolean
  optional?: boolean
  type: DataType
  // relational fields should be virtual
  relation?: Relation
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
    options: FindOneOptions,
  ) => Promise<Record<string, any>>
  // retrieve many documents matching a where clause
  findMany: (
    collection: string,
    options: FindManyOptions,
  ) => Promise<Record<string, any>[]>
  // count document matching a where clause
  count: (collection: string, where: WhereClause) => Promise<number>
  // update some documents returning the number updated
  update: (collection: string, options: UpdateOptions) => Promise<number>
  // update or create some documents
  upsert: (
    collection: string,
    options: UpsertOptions,
  ) => Promise<{ created: number; updated: number }>
  // request that an index be created between some keys, if supported
  ensureIndex: (collection: string, name: string, keys: string[]) => void
  // provide a schema to connectors that need schema info
  createTables: (tableData: TableData[]) => Promise<void>
  // delete a single document, return the number of documents deleted
  deleteOne: (collection: string, options: FindOneOptions) => Promise<number>
  // delete many documents, return the number of documents deleted
  deleteMany: (collection: string, options: FindManyOptions) => Promise<number>
  // close the db and cleanup
  close: () => Promise<void>
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
        rows: { [rowKey: string]: RowDef | undefined }
        relations: {
          [relation: string]: (Relation & { name: string }) | undefined
        }
      }
    | undefined
}

export function constructSchema(tables: TableData[]): Schema {
  const schema = {}
  for (const table of tables) {
    schema[table.name] = {
      rows: {},
      relations: {},
    }
    for (const row of table.rows) {
      const fullRow = normalizeRowDef(row)
      schema[table.name].rows[fullRow.name] = fullRow
      if (fullRow.relation) {
        schema[table.name].relations[fullRow.name] = {
          name: fullRow.name,
          ...fullRow.relation,
        }
      }
    }
  }
  return schema
}
