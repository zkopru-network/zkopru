import { TableData, normalizeRowDef } from '../types'

export const escapeQuotes = (str: string) => {
  if (str === null) console.log(new Error().stack)
  return str.replace(/"/gm, '""')
}

export function parseType(type: string, value: any) {
  if (value === null || value === undefined) return 'NULL'
  if (type === 'String' && typeof value === 'string') {
    return `"${escapeQuotes(value)}"`
  }
  if (type === 'Int' && typeof value === 'number') {
    return `${value}`
  }
  if (type === 'Bool' && typeof value === 'boolean') {
    return value ? 'true' : 'false'
  }
  if (type === 'Object' && typeof value === 'object') {
    return `"${escapeQuotes(JSON.stringify(value))}"`
  }
  throw new Error(`Unrecognized value "${value}" for type ${type}`)
}

export function whereToSql(table: TableData, doc: any = {}, sqlOnly = false) {
  if (Object.keys(doc).length === 0) return ''
  const sql = Object.keys(doc)
    .map(key => {
      if (key === 'OR') return
      const rowDef = table.rows[key]
      if (!rowDef)
        throw new Error(`Unable to find row definition for key: "${key}"`)
      const val = doc[key]
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
          const operator =
            val[k] === null ? nullOperatorMap[k] : operatorMap[k]
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
  if (Array.isArray(doc.OR)) {
    const orConditions = doc.OR.map((w: any) =>
      whereToSql(table, w, true),
    ).join(' OR ')
    return ` ${sqlOnly ? '' : 'WHERE'}
    (${sql || 1}) AND (${orConditions})`
  }
  return ` ${sqlOnly ? '' : 'WHERE'} ${sql} `
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
    commands.push(`CREATE TABLE IF NOT EXISTS ${name} (
      ${[rowCommands.join(','), relationCommands.join(',')]
        .filter(i => !!i)
        .join(',')}
    );`)
  }
  return commands.join(' ')
}
