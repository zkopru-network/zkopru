import { TableData } from '~database'

export default [
  {
    name: 'TableOne',
    primaryKey: 'id',
    rows: [
      {
        name: 'id',
        type: 'String',
        default: () => Math.random().toString(),
      },
      ['uniqueField', 'String', { unique: true }],
      ['uniqueAndOptionalField', 'String', { unique: true, optional: true }],
      ['optionalField', 'String', { optional: true }],
      ['regularField', 'String'],
    ],
  },
  {
    name: 'TableTwo',
    primaryKey: 'id',
    rows: [
      {
        name: 'id',
        type: 'String',
        // so this can be meaningfully lexographically sorted
        default: () => `${+new Date()}${Math.random()}`,
      },
      ['counterField', 'Int', { unique: true }],
    ],
  },
  {
    name: 'TableThree',
    primaryKey: 'id',
    rows: [
      {
        name: 'id',
        type: 'String',
      },
      {
        name: 'optionalField',
        type: 'String',
        optional: true,
      },
    ],
  },
  {
    name: 'TableFour',
    primaryKey: 'id',
    rows: [
      ['id', 'String'],
      ['relation1Id', 'String'],
      {
        name: 'relation1',
        type: 'String',
        relation: {
          foreignField: 'id',
          localField: 'relation1Id',
          foreignTable: 'Relation1',
        },
      },
    ],
  },
  {
    name: 'Relation1',
    primaryKey: 'id',
    rows: [
      ['id', 'String'],
      ['relation2Id', 'String'],
      {
        name: 'relation2',
        type: 'String',
        relation: {
          foreignField: 'id',
          localField: 'relation2Id',
          foreignTable: 'Relation2',
        },
      },
    ],
  },
  {
    name: 'Relation2',
    primaryKey: 'id',
    rows: [['id', 'String']],
  },
  {
    name: 'Table5',
    primaryKey: 'id',
    rows: [
      ['id', 'Int'],
      ['optionalField', 'Bool', { optional: true }],
    ],
  },
  {
    name: 'Table6',
    primaryKey: 'id',
    rows: [
      ['id', 'Int'],
      ['boolField', 'Bool'],
      ['stringField', 'String'],
      ['objectField', 'Object'],
    ],
  },
] as TableData[]
