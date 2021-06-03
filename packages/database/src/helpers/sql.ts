import {
  TableData,
  normalizeRowDef,
  FindManyOptions,
  SchemaTable,
  WhereClause,
  UpdateOptions,
  DeleteManyOptions,
  UpsertOptions,
} from '../types'

export const escapeQuotes = (str: string) => {
  if (str === null) console.log(new Error().stack)
  return str.replace(/"/gm, '""')
}

export const escapeSingleQuotes = (str: string) => str.replace(/'/gm, `''`)

export function parseType(type: string, value: any) {
  if (value === null || value === undefined) return 'NULL'
  if (type === 'String' && typeof value === 'string') {
    return `'${escapeSingleQuotes(value)}'`
  }
  if (type === 'Int' && typeof value === 'number') {
    return `${value}`
  }
  if (type === 'Bool' && typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  if (type === 'Object' && typeof value === 'object') {
    return `'${escapeSingleQuotes(JSON.stringify(value))}'`
  }
  throw new Error(`Unrecognized value "${value}" for type ${type}`)
}

export function whereToSql(table: SchemaTable, doc: any = {}, sqlOnly = false) {
  if (Object.keys(doc).length === 0) return ''
  const sql = Object.keys(doc)
    .map(key => {
      if (key === 'OR' || key === 'AND') return
      const rowDef = table.rowsByName[key]
      if (!rowDef)
        throw new Error(`Unable to find row definition for key: "${key}"`)
      const val = doc[key]
      if (Array.isArray(val) && val.length === 0) {
        // An empty IN operator should match nothing
        return '(false)'
      }
      if (Array.isArray(val)) {
        // need to generate an IN query
        const values = val.map(v => parseType(rowDef.type, v))
        return `"${key}" IN (${values.join(',')})`
      }
      if (typeof val === 'object' && val !== null) {
        // parse lt, gt, lte, gte, ne operators
        const operatorMap = {
          lt: '<',
          gt: '>',
          lte: '<=',
          gte: '>=',
          ne: '!=',
          eq: '=',
        }
        const nullOperatorMap = {
          ne: 'IS NOT',
          eq: 'IS',
        }
        return Object.keys(val).map(k => {
          if (k === 'nin') {
            if (!Array.isArray(val[k]))
              throw new Error(`Non array value provided for nin operator`)
            // need to generate a NOT IN query
            const values = val[k].map((v: any) => parseType(rowDef.type, v))
            return `"${key}" NOT IN (${values.join(',')})`
          }
          const operator = val[k] === null ? nullOperatorMap[k] : operatorMap[k]
          if (!operator) throw new Error(`Invalid operator ${k}`)
          const parsed = parseType(rowDef.type, val[k])
          return `"${key}" ${operator} ${parsed}`
        })
      }
      const parsed = parseType(rowDef.type, val)
      return `"${key}" ${parsed === 'NULL' ? 'IS' : '='} ${parsed}`
    })
    .flat()
    .filter(i => !!i)
    .join(' AND ')
  const orConditions = Array.isArray(doc.OR)
    ? doc.OR.map((w: any) => whereToSql(table, w, true)).join(' OR ')
    : 'true'
  const andConditions = Array.isArray(doc.AND)
    ? doc.AND.map((w: any) => whereToSql(table, w, true)).join(' AND ')
    : 'true'
  return ` ${sqlOnly ? '' : 'WHERE'} (${sql ||
    'true'}) AND (${orConditions}) AND (${andConditions})`
  // if (Array.isArray(doc.OR)) {
  //   const orConditions = doc.OR.map((w: any) =>
  //     whereToSql(table, w, true),
  //   ).join(' OR ')
  //   return ` ${sqlOnly ? '' : 'WHERE'}
  //   (${sql || 'true'}) AND (${orConditions})`
  // }
  // return ` ${sqlOnly ? '' : 'WHERE'} ${sql} `
}

export function tableCreationSql(tableData: TableData[]) {
  // const schema = constructSchema(tableData)
  // run sql queries creating the tables as necessary
  const commands = [] as string[]
  for (const table of tableData) {
    const { name, primaryKey, rows } = table
    const typeMap = {
      String: 'TEXT',
      Int: 'INTEGER',
      Bool: 'BOOLEAN',
      Object: 'TEXT', // serialize via json in connector
    }
    const rowCommands = rows
      .map(row => {
        const fullRow = normalizeRowDef(row)
        // relations are virtual and assigned at load time
        if (fullRow.relation) return
        return `"${fullRow.name}" ${typeMap[fullRow.type]} ${
          fullRow.optional ? '' : 'NOT NULL'
        } ${fullRow.unique ? 'UNIQUE' : ''}`
      })
      .filter(i => !!i)
    // Do i even need this if i'm loading manually????
    // const relationCommands = rows
    //   .map(row => {
    //     const fullRow = normalizeRowDef(row)
    //     if (!fullRow.relation) return
    //     return `FOREIGN KEY ("${fullRow.relation.localField}")
    //     REFERENCES "${fullRow.relation.foreignTable}" ("${fullRow.relation.foreignField}")
    //       ON DELETE SET NULL
    //       ON UPDATE NO ACTION`
    //   })
    //   .filter(i => !!i)
    const relationCommands = [] as string[]
    if (primaryKey) {
      const primaryKeys = [primaryKey]
        .flat()
        .map((name: string) => `"${name}"`)
        .join(',')
      relationCommands.push(`PRIMARY KEY (${primaryKeys})`)
    }
    // assume there's always at least 1 entry in rowCommands and relationCommands
    commands.push(`CREATE TABLE IF NOT EXISTS "${name}" (
      ${[rowCommands.join(','), relationCommands.join(',')]
        .filter(i => !!i)
        .join(',')}
    );`)
  }
  return commands.join(' ')
}

export function createSql(
  table: SchemaTable,
  _doc: any | any,
): { sql: string; query: object } {
  // create defaults where needed
  const docs = [_doc].flat()
  for (const [, row] of Object.entries(table.rows)) {
    for (const doc of docs) {
      if (
        !row?.default ||
        (doc[row.name] !== undefined && doc[row.name] !== null)
      )
        // eslint-disable-next-line no-continue
        continue
      // otherwise generate default field
      Object.assign(doc, {
        [row.name]:
          typeof row.default === 'function' ? row.default() : row.default,
      })
    }
  }
  // generate keys using first document
  const allKeys = [] as string[]
  for (const doc of docs) {
    allKeys.push(...Object.keys(doc))
  }
  const keys = [] as string[]
  for (const key of allKeys) {
    // eslint-disable-next-line no-continue
    if (keys.indexOf(key) !== -1) continue
    keys.push(key)
  }
  // query for retrieving the created documents, uses IN operator for all
  // primary keys
  const uniqueKeys = keys.filter(k => table.rowsByName[k]?.unique)
  const query = [table.primaryKey, uniqueKeys].flat().reduce((acc, key) => {
    if (key === undefined) return acc
    return {
      ...acc,
      [key]: [],
    }
  }, {})
  const keyString = keys.map(k => `"${k}"`).join(',')
  const allValues = [] as string[]
  for (const doc of docs) {
    const values = keys
      .map(k => {
        const rowDef = table.rowsByName[k]
        if (!rowDef)
          throw new Error(`Unable to find row definition for key: "${k}"`)
        if (query[k]) {
          query[k].push(doc[k])
        }
        return parseType(rowDef.type, doc[k])
      })
      .join(',')
    allValues.push(`(${values})`)
  }
  return {
    sql: `INSERT INTO "${table.name}" (${keyString}) VALUES ${allValues.join(
      ', ',
    )};`,
    query,
  }
}

export function findManySql(
  table: SchemaTable,
  options: FindManyOptions,
): string {
  const { where } = options
  const orderBy =
    options.orderBy && Object.keys(options.orderBy).length > 0
      ? ` ORDER BY ${Object.keys(options.orderBy)
          .map(key => {
            const val = (options.orderBy || {})[key]
            return `"${key}" ${val.toUpperCase()}`
          })
          .join(', ')}`
      : ''
  const limit = options.limit ? ` LIMIT ${options.limit} ` : ''
  return `SELECT * FROM "${table.name}" ${whereToSql(
    table,
    where,
  )} ${orderBy} ${limit};`
}

export function countSql(table: SchemaTable, where: WhereClause): string {
  return `SELECT COUNT(*) FROM "${table.name}" ${whereToSql(table, where)};`
}

export function updateSql(table: SchemaTable, options: UpdateOptions): string {
  const { where, update } = options
  const setSql = Object.keys(update)
    .map(key => {
      const rowDef = table.rowsByName[key]
      if (!rowDef)
        throw new Error(`Unable to find row definition for key: "${key}"`)
      return `"${key}" = ${parseType(rowDef.type, update[key])}`
    })
    .join(', ')
  return `UPDATE "${table.name}" SET ${setSql} ${whereToSql(table, where)};`
}

export function deleteManySql(
  table: SchemaTable,
  options: DeleteManyOptions,
): string {
  // const constraintKey =
  //   typeof table.primaryKey === 'string'
  //     ? table.primaryKey
  //     : table.rows.map(normalizeRowDef).find(row => row.unique)?.name
  // const orderBySql =
  //   options.orderBy && Object.keys(options.orderBy).length > 0
  //     ? ` ORDER BY ${Object.keys(options.orderBy)
  //         .map(key => {
  //           const val = (options.orderBy || {})[key]
  //           return `"${key}" ${val.toUpperCase()}`
  //         })
  //         .join(', ')}`
  //     : ''
  // const limitSql = options.limit === undefined ? '' : ` LIMIT ${options.limit} `
  if (Object.keys(options.where).length === 0)
    return `DELETE FROM "${table.name}";`
  return `DELETE FROM "${table.name}" ${whereToSql(table, options.where)};`
  // return `DELETE FROM "${table.name}" WHERE "${constraintKey}" IN
  // (SELECT "${constraintKey}" FROM "${table.name}" ${whereToSql(
  //   table,
  //   options.where,
  // )} ${orderBySql} ${limitSql});`
}

export function upsertSql(table: SchemaTable, options: UpsertOptions): string {
  const { sql } = createSql(table, options.create)
  // remove the semicolon in the creation sql command
  const creationSql = sql.replace(';', '')
  const uniqueFields = [] as string[]
  for (const rawRow of table.rows) {
    const row = normalizeRowDef(rawRow)
    if ([table.primaryKey].flat().indexOf(row.name) === -1 && !row.unique)
      // eslint-disable-next-line no-continue
      continue
    // otherwise check if the key is present in the where clause
    if (typeof options.where[row.name] !== 'undefined')
      uniqueFields.push(row.name)
  }
  const conflictConstraint = [options.constraintKey || uniqueFields]
    .flat()
    .map(name => `"${name}"`)
    .join(',')
  const updateSqlCommand = Object.keys(options.update)
    .map(key => {
      const rowDef = table.rowsByName[key]
      if (!rowDef)
        throw new Error(`Unable to find row definition for key: "${key}"`)
      return `"${key}" = ${parseType(rowDef.type, options.update[key])}`
    })
    .join(', ')
  const conflictClause =
    Object.keys(options.update).length === 0
      ? 'DO NOTHING;'
      : `DO UPDATE SET ${updateSqlCommand};`
  return `${creationSql}
  ON CONFLICT(${conflictConstraint})
  ${conflictClause}`
}
