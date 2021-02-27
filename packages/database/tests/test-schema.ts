import { TableData } from '~database'

export default [
  {
    name: 'TableOne',
    primaryKey: 'id',
    rows: [
      {
        name: 'id',
        type: 'String',
        default: () => Math.random().toString()
      },
      ['uniqueField', 'String', { unique: true, }],
      ['uniqueAndOptionalField', 'String', { unique: true, optional: true }],
      ['optionalField', 'String', { optional: true }],
      ['regularField', 'String']
    ]
  },
  {
    name: 'TableTwo',
    primaryKey: 'id',
    rows: [
      {
        name: 'id',
        type: 'String',
        // so this can be meaningfully lexographically sorted
        default: () => `${+new Date()}${Math.random()}`
      },
      ['counterField', 'Int', { unique: true }]
    ]
  }
] as TableData[]
