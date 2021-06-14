/* eslint-disable no-underscore-dangle */
import { SchemaTable, WhereClause } from '../types'

// Validate documents, insert defaults, ensure non-optional fields are present
export function validateDocuments(table: SchemaTable, _docs: any | any[]) {
  return [_docs].flat().map(doc => {
    // insert defaults where needed
    const defaults = {}
    for (const key of Object.keys(table.rowsByName)) {
      const row = table.rowsByName[key]
      if (!row) throw new Error('Expected row to exist')
      if (
        row.default &&
        (doc[row.name] === undefined || doc[row.name] === null)
      ) {
        Object.assign(defaults, {
          [row.name]:
            typeof row.default === 'function' ? row.default() : row.default,
        })
      }
      const wipDoc = {
        ...defaults,
        ...doc,
      }
      if (
        !row.optional &&
        !row.relation &&
        (wipDoc[row.name] === undefined || wipDoc[row.name] === null)
      ) {
        throw new Error(`NULL received for non-optional field "${row.name}"`)
      }
      if (
        typeof wipDoc[row.name] !== 'undefined' &&
        wipDoc[row.name] !== null
      ) {
        if (row.type === 'Bool' && typeof wipDoc[row.name] !== 'boolean') {
          throw new Error(
            `Unrecognized value ${wipDoc[row.name]} for type Bool`,
          )
        } else if (row.type === 'Int' && typeof wipDoc[row.name] !== 'number') {
          throw new Error(`Unrecognized value ${wipDoc[row.name]} for type Int`)
        } else if (
          row.type === 'String' &&
          typeof wipDoc[row.name] !== 'string'
        ) {
          throw new Error(
            `Unrecognized value ${wipDoc[row.name]} for type String`,
          )
        } else if (
          row.type === 'Object' &&
          typeof wipDoc[row.name] !== 'object'
        ) {
          throw new Error(
            `Unrecognized value ${wipDoc[row.name]} for type Object`,
          )
        }
      }
    }
    return {
      ...defaults,
      ...doc,
    }
  }) as any[]
}

// Matches without considering OR clauses
function _matchDocument(where: WhereClause, doc: any) {
  for (const [key, val] of Object.entries(where)) {
    if (typeof val === 'object' && !Array.isArray(val) && val !== null) {
      if (typeof val.ne !== 'undefined' && doc[key] === val.ne) {
        return false
      }
      if (typeof val.lt !== 'undefined' && doc[key] >= val.lt) {
        return false
      }
      if (typeof val.lte !== 'undefined' && doc[key] > val.lte) {
        return false
      }
      if (typeof val.gt !== 'undefined' && doc[key] <= val.gt) {
        return false
      }
      if (typeof val.gte !== 'undefined' && doc[key] < val.gte) {
        return false
      }
      if (typeof val.nin !== 'undefined') {
        if (!Array.isArray(val.nin))
          throw new Error('Invalid nin value provided, must be array')
        for (const v of val.nin) {
          if (doc[key] === v) return false
        }
      }
    } else if (Array.isArray(val)) {
      let exists = false
      for (const v of val) {
        if (v === null && typeof doc[key] === 'undefined') {
          exists = true
          break
        }
        if (doc[key] === v) {
          exists = true
          break
        }
      }
      if (!exists) return false
    } else if (
      val === null &&
      typeof doc[key] !== 'undefined' &&
      doc[key] !== null
    ) {
      return false
    } else if (val !== null && doc[key] !== val) {
      return false
    }
  }
  return true
}

// Match a document in memory
export function matchDocument(where: WhereClause, doc: any) {
  const topWhere = { ...where, OR: undefined, AND: undefined }
  const or = where.OR || []
  const and = where.AND || []
  const matched = _matchDocument(topWhere, doc)
  if (!matched) return false
  if (or.length === 0 && and.length === 0 && matched) {
    return true
  }
  for (const _where of and) {
    // All AND clauses must be met
    if (!matchDocument(_where, doc)) return false
  }
  if (or.length === 0) return true
  for (const _where of or) {
    // only 1 OR clause must be matched
    if (matchDocument(_where, doc) && matched) {
      return true
    }
  }
  return false
}
