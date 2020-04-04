/* eslint-disable jest/no-hooks */
import { Field } from '@zkopru/core'
import { nSQL } from '@nano-sql/core'
// eslint-disable-next-line import/no-extraneous-dependencies
import { RocksDB } from '@nano-sql/adapter-rocksdb'
// eslint-disable-next-line import/no-extraneous-dependencies
import fs from 'fs-extra'

describe('unit test', () => {
  const depth = 31
  const siblingTable = schema.siblingTable('utxo1', depth)
  const treeInfoTable = schema.treeInfo('grove1')
  let database: RocksDB
  beforeAll(async () => {
    fs.removeSync('temp')
    fs.mkdirSync('temp')
    database = new RocksDB('temp')
    await nSQL().createDatabase({
      id: 'test-database',
      mode: database,
      tables: [siblingTable, treeInfoTable],
    })
  })
  afterAll(async () => {
    fs.removeSync('temp')
  })
  it('field', () => {
    expect.hasAssertions()
    expect(Field.from(1)).toBeDefined()
  })
  it('nSQL', async () => {
    expect(
      await nSQL(siblingTable.name)
        .query('total')
        .exec(),
    ).toStrictEqual([{ total: 0 }])
    await nSQL(siblingTable.name)
      .query(
        'upsert',
        [...Array(depth)].map((_, index) => {
          return {
            level: index + 1,
            value: Buffer.from(`${index}`),
          }
        }),
      )
      .exec()
    const sib: unknown[] = await nSQL(siblingTable.name)
      .query('select')
      .exec()
    console.log(sib)
    const result = await nSQL(siblingTable.name)
      .query('total', { rebuild: true })
      .exec()
    console.log(result)
    expect(result).toStrictEqual([{ total: depth }])
  })
  describe('treeInfo()', () => {
    it('should store a object into the database', async () => {
      await nSQL(treeInfoTable.name)
        .query('upsert', [
          {
            tree: `utxo-${0}`,
            data: {
              root: '0x1111',
              index: '0x1234',
              siblings: [
                '0x123321',
                '0x123321',
                '0x123321',
                '0x123321',
                '0x123321',
              ],
            },
          },
          {
            tree: `utxo-${1}`,
            data: {
              depth: 31,
              root: Buffer.from('0x1111'),
              index: Buffer.from('0x1234'),
              siblings: [
                Buffer.from('0x123321'),
                Buffer.from('0x123321'),
                Buffer.from('0x123321'),
                Buffer.from('0x123321'),
                Buffer.from('0x123321'),
              ],
            },
          },
        ])
        .exec()
      const result = await nSQL(treeInfoTable.name)
        .query('select')
        .where(['tree', '=', 'utxo-0'])
        .exec()
      // console.log(Field.fromBuffer(result[0].data.siblings))
    })
  })
})
