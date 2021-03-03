import { promises as fs } from 'fs'
import path from 'path'
import schema from '../src/schema'
import { normalizeRowDef } from '../src/types'

const typeMap = {
  'String': 'string',
  'Bool': 'boolean',
  'Int': 'number',
  'Object': 'Object',
}

const types = [] as string[]

for (const table of schema) {
  const rowTypes = [] as string[]
  for (const row of table.rows) {
    const rowDef = normalizeRowDef(row as any)
    const optional = rowDef.optional || typeof rowDef.relation !== 'undefined'
    rowTypes.push(`${rowDef.name}${optional ? '?' : ''}: ${typeMap[rowDef.type]};`)
  }
  types.push(`export type ${table.name} = {
  ${rowTypes.join('\n  ')}
}`)
}
const typeString = types.join('\n\n')

;(async () => {
  await fs.writeFile(path.join(__dirname, '../src/schema.types.ts'), typeString)
})()
