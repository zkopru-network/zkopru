import assert from 'assert'
import testSchema from './test-schema'
import { SQLiteConnector } from '~database'

describe('database tests', () => {
  it('should create tables', async () => {
    const db = await SQLiteConnector.create(':memory:')
    await db.createTables(testSchema)
    const table = 'TableOne'
    await db.create(table, {
      uniqueField: 'testvalue',
      regularField: 'value',
    })
    const doc = await db.findOne(table, {
      where: { uniqueField: 'testvalue' },
    })
    assert(doc, 'Inserted document does not exist')
  })

  it('should find sorted documents', async () => {
    const db = await SQLiteConnector.create(':memory:')
    const table = 'TableTwo'
    await db.createTables(testSchema)
    for (let x = 0; x < 10; x++) {
      await db.create(table, {
        counterField: x,
      })
      await new Promise(r => setTimeout(r, 10))
    }
    const docs = await db.findMany(table, {
      where: {},
      orderBy: { id: 'asc' },
    })
    assert.equal(docs.length, 10)
    for (let x = 0; x < docs.length - 1; x++) {
      assert(
        docs[x].counterField < docs[x + 1].counterField,
        'Documents incorrectly ordered',
      )
    }
    const docs2 = await db.findMany(table, {
      where: {},
      orderBy: { id: 'desc' },
    })
    assert.equal(docs2.length, 10)
    for (let x = 0; x < docs2.length - 1; x++) {
      assert(
        docs2[x].counterField > docs2[x + 1].counterField,
        'Documents incorrectly ordered',
      )
    }
  })
})
