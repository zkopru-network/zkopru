/* eslint-disable no-plusplus, jest/no-hooks */
import assert from 'assert'
import testSchema from './test-schema'
import { SQLiteConnector } from '~database'

describe('database tests', () => {
  let db: SQLiteConnector
  beforeEach(async () => {
    db = await SQLiteConnector.create(':memory:')
  })

  afterEach(async () => {
    db.close()
  })

  it('should create tables', async () => {
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

  it('should create documents', async () => {
    await db.createTables(testSchema)
    const table = 'TableThree'
    {
      const count = await db.create(table, {
        id: 'test',
      })
      assert.equal(count, 1)
    }
    {
      const count = await db.create(table, [
        {
          id: 'test1',
        },
        {
          id: 'test2',
          optionalField: 'test',
        },
        {
          id: 'test3',
          optionalField: 'anothertest',
        },
      ])
      assert.equal(count, 3)
    }
  })

  it('should find one', async () => {
    await db.createTables(testSchema)
    const table = 'TableThree'
    for (let x = 0; x < 10; x++) {
      await db.create(table, {
        id: `test${x}`,
        optionalField: 'test',
      })
    }
    {
      const row = await db.findOne(table, {
        where: { optionalField: 'test' },
        orderBy: { id: 'asc' },
      })
      assert.equal(row.id, 'test0')
    }
    {
      const row = await db.findOne(table, {
        where: { optionalField: 'test' },
        orderBy: { id: 'desc' },
      })
      assert.equal(row.id, 'test9')
    }
  })

  it('should find many', async () => {
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

  it('should find using in operator', async () => {
    await db.createTables(testSchema)
    const table = 'TableThree'
    for (let x = 0; x < 10; x++) {
      await db.create(table, {
        id: `test${x}`,
        optionalField: 'test',
      })
    }
    const rows = await db.findMany(table, {
      where: {
        id: ['test0', 'test2', 'test4'],
      },
    })
    assert.equal(rows.length, 3)
    assert.equal(rows[0].id, 'test0')
    assert.equal(rows[1].id, 'test2')
    assert.equal(rows[2].id, 'test4')
  })

  it('should load nested relations', async () => {
    await db.createTables(testSchema)
    await db.create('TableFour', [
      {
        id: 'test0',
        relation1Id: 'test0',
      },
      {
        id: 'test1',
        relation1Id: 'test1',
      },
    ])
    await db.create('Relation1', [
      {
        id: 'test0',
        relation2Id: 'test0',
      },
      {
        id: 'test1',
        relation2Id: 'test1',
      },
      {
        id: 'test2',
        relation2Id: 'test2',
      },
    ])
    await db.create('Relation2', [
      {
        id: 'test0',
      },
      {
        id: 'test1',
      },
      {
        id: 'test2',
      },
    ])
    {
      const row = await db.findOne('TableFour', {
        where: { id: 'test0' },
        include: { relation1: { relation2: true } },
      })
      assert.equal(typeof row.relation1, 'object')
      assert.equal(row.relation1.relation2.id, 'test0')
    }
    {
      const row = await db.findOne('TableFour', {
        where: { id: 'test0' },
        include: { relation1: true },
      })
      assert.equal(typeof row.relation1, 'object')
      assert.equal(typeof row.relation1.relation2, 'undefined')
    }
  })

  it('should count documents', async () => {
    await db.createTables(testSchema)
    const table = 'Table5'
    await db.create(table, [
      { id: 0 },
      { id: 1, optionalField: true },
      { id: 2, optionalField: true },
      { id: 3, optionalField: true },
    ])
    assert.equal(await db.count(table, {}), 4)
    assert.equal(await db.count(table, { id: 1 }), 1)
    assert.equal(await db.count(table, { id: [0, 2] }), 2)
    assert.equal(await db.count(table, { optionalField: true }), 3)
    assert.equal(await db.count(table, { optionalField: false }), 0)
    assert.equal(await db.count(table, { optionalField: null }), 1)
  })

  it('should handle object type', async () => {
    await db.createTables(testSchema)
    const table = 'Table6'
    await db.create(table, [
      {
        id: 0,
        boolField: true,
        stringField: 'test',
        objectField: { test: 'obj' },
      },
    ])
    const row = await db.findOne(table, { where: { id: 0 } })
    assert.equal(typeof row.objectField, 'object')
    assert.equal(row.objectField.test, 'obj')
  })

  it('should perform update', async () => {
    await db.createTables(testSchema)
    const table = 'Table6'
    await db.create(table, [
      {
        id: 0,
        boolField: true,
        stringField: 'test',
        objectField: { test: 'obj' },
      },
      {
        id: 1,
        boolField: true,
        stringField: 'test',
        objectField: { test: 'obj' },
      },
    ])
    {
      const row = await db.findOne(table, { where: { id: 0 } })
      assert.equal(typeof row.objectField, 'object')
      assert.equal(row.objectField.test, 'obj')
      assert.equal(row.boolField, true)
      assert.equal(row.stringField, 'test')
    }
    const changes = await db.update(table, {
      where: { id: [0, 1] },
      update: {
        objectField: {
          newProp: 'exists',
        },
        boolField: false,
        stringField: 'newTest',
      },
    })
    assert.equal(changes, 2)
    {
      const row = await db.findOne(table, { where: { id: 0 } })
      assert.equal(typeof row.objectField, 'object')
      assert.equal(row.objectField.newProp, 'exists')
      assert.equal(row.boolField, false)
      assert.equal(row.stringField, 'newTest')
    }
  })

  it('should perform upsert', async () => {
    await db.createTables(testSchema)
    const table = 'Table6'
    {
      const { updated, created } = await db.upsert(table, {
        where: { id: 0 },
        create: {
          id: 0,
          boolField: true,
          stringField: 'test',
          objectField: { test: 'obj' },
        },
        update: {},
      })
      assert.equal(created, 1)
      assert.equal(updated, 0)
    }
    {
      const { updated, created } = await db.upsert(table, {
        where: { id: 0 },
        create: {
          id: 0,
          boolField: true,
          stringField: 'test',
          objectField: { test: 'obj' },
        },
        update: {
          boolField: false,
        },
      })
      assert.equal(created, 0)
      assert.equal(updated, 1)
    }
  })

  it('should use operators', async () => {
    const table = 'TableTwo'
    await db.createTables(testSchema)
    for (let x = 0; x < 10; x++) {
      await db.create(table, {
        counterField: x,
      })
      await new Promise(r => setTimeout(r, 10))
    }
    {
      const docs = await db.findMany(table, {
        where: {
          counterField: { lt: 3 }
        },
      })
      assert.equal(docs.length, 3)
    }
    {
      const docs = await db.findMany(table, {
        where: {
          counterField: { lte: 3 }
        },
      })
      assert.equal(docs.length, 4)
    }
    {
      const docs = await db.findMany(table, {
        where: {
          counterField: { gt: 3 }
        },
      })
      assert.equal(docs.length, 6)
    }
    {
      const docs = await db.findMany(table, {
        where: {
          counterField: { gte: 3 }
        },
      })
      assert.equal(docs.length, 7)
    }
    {
      const docs = await db.findMany(table, {
        where: {
          counterField: { ne: 3 }
        },
      })
      assert.equal(docs.length, 9)
    }
  })
})
