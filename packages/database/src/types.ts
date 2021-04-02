export type WhereClause = { [key: string]: any }

export type FindManyOptions = {
  where: WhereClause
  orderBy?: {
    [key: string]: 'asc' | 'desc'
  }
  include?: {
    [key: string]: boolean | any
  }
  limit?: number
}

export type FindOneOptions = {
  where: WhereClause
  orderBy?: {
    [key: string]: 'asc' | 'desc'
  }
  include?: {
    [key: string]: boolean | any
  }
}

export type DeleteManyOptions = {
  where: WhereClause
}

export type UpdateOptions = {
  where: WhereClause
  update: any
}

export type UpsertOptions = {
  where: WhereClause
  update: any
  create: any
  constraintKey?: string
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
  index?: boolean
  type: DataType
  // relational fields should be virtual
  relation?: Relation
  default?: any | 'autoincrement'
}

export type ShortRowDef = [
  string,
  DataType,
  { index?: boolean; optional?: boolean; unique?: boolean } | undefined,
]

export interface TableData {
  name: string
  primaryKey: string | string[]
  rows: (RowDef | ShortRowDef)[]
}

export abstract class DB {
  static create: (tables: TableData[], ...args: any[]) => Promise<DB>

  abstract create(collection: string, doc: any | any[]): Promise<any>

  abstract findOne(collection: string, options: FindOneOptions): Promise<any>

  // retrieve many documents matching a where clause
  abstract findMany(
    collection: string,
    options: FindManyOptions,
  ): Promise<any[]>

  // count document matching a where clause
  abstract count(collection: string, where: WhereClause): Promise<number>

  // update some documents returning the number updated
  abstract update(collection: string, options: UpdateOptions): Promise<number>

  // update or create some documents
  abstract upsert(collection: string, options: UpsertOptions): Promise<number>

  // delete many documents, return the number of documents deleted
  abstract delete(
    collection: string,
    options: DeleteManyOptions,
  ): Promise<number>

  abstract transaction(operation: (db: TransactionDB) => void): Promise<void>

  // close the db and cleanup
  abstract close(): Promise<void>
}

// The object available in a transaction context
export interface TransactionDB {
  create: (collection: string, doc: any | any[]) => void
  update: (collection: string, options: UpdateOptions) => void
  upsert: (collection: string, options: UpsertOptions) => void
  // deleteOne: (collection: string, options: FindOneOptions) => void
  delete: (collection: string, options: DeleteManyOptions) => void
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

export type SchemaTable = {
  rowsByName: { [rowKey: string]: RowDef | undefined }
  relations: {
    [relation: string]: (Relation & { name: string }) | undefined
  }
  rows: RowDef[]
} & TableData

export type Schema = {
  [tableKey: string]: SchemaTable | undefined
}

export function constructSchema(tables: TableData[]): Schema {
  const schema = {}
  for (const table of tables) {
    schema[table.name] = {
      relations: {},
      rowsByName: {},
      ...table,
    }
    for (const row of table.rows) {
      const fullRow = normalizeRowDef(row)
      schema[table.name].rowsByName[fullRow.name] = fullRow
      schema[table.name].rows = schema[table.name].rows.map(normalizeRowDef)
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
