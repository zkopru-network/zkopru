/* eslint-disable jest/require-top-level-describe, no-plusplus, jest/no-export */
import assert from 'assert'
import { DB } from '~database'

export default function(this: { db: DB }) {
  test('should create tables', async () => {
    const table = 'TableOne'
    await this.db.create(table, {
      uniqueField: 'testvalue',
      regularField: 'value',
    })
    const doc = await this.db.findOne(table, {
      where: { uniqueField: 'testvalue' },
    })
    assert(doc, 'Inserted document does not exist')
  })

  test('should create documents', async () => {
    const table = 'TableThree'
    {
      const created = await this.db.create(table, {
        id: 'test',
      })
      assert.equal(created.id, 'test')
    }
    {
      const docs = await this.db.create(table, [
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
      assert.equal(docs[0].id, 'test1')
      assert.equal(docs[1].id, 'test2')
      assert.equal(docs[2].id, 'test3')
    }
  })

  test('should find one', async () => {
    const table = 'TableThree'
    for (let x = 0; x < 10; x++) {
      await this.db.create(table, {
        id: `test${x}`,
        optionalField: 'test',
      })
    }
    {
      const row = await this.db.findOne(table, {
        where: { optionalField: 'test' },
        orderBy: { id: 'asc' },
      })
      assert.equal(row.id, 'test0')
    }
    {
      const row = await this.db.findOne(table, {
        where: { optionalField: 'test' },
        orderBy: { id: 'desc' },
      })
      assert.equal(row.id, 'test9')
    }
  })

  test('should return null if not found', async () => {
    const table = 'TableThree'
    const r = await this.db.findOne(table, {
      where: {
        optionalField: 'nonexistent',
      },
    })
    assert.strictEqual(r, null)
  })

  test('should find many', async () => {
    const table = 'TableTwo'
    for (let x = 0; x < 10; x++) {
      await this.db.create(table, {
        counterField: x,
      })
      await new Promise(r => setTimeout(r, 10))
    }
    const docs = await this.db.findMany(table, {
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
    const docs2 = await this.db.findMany(table, {
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

  test('should find using in operator', async () => {
    const table = 'TableThree'
    for (let x = 0; x < 10; x++) {
      await this.db.create(table, {
        id: `test${x}`,
        optionalField: 'test',
      })
    }
    const rows = await this.db.findMany(table, {
      where: {
        id: ['test0', 'test2', 'test4'],
      },
    })
    assert.equal(rows.length, 3)
    assert.equal(rows[0].id, 'test0')
    assert.equal(rows[1].id, 'test2')
    assert.equal(rows[2].id, 'test4')
  })

  test('should load nested relations', async () => {
    await this.db.create('TableFour', [
      {
        id: 'test0',
        relation1Id: 'test0',
      },
      {
        id: 'test1',
        relation1Id: 'test1',
      },
    ])
    await this.db.create('Relation1', [
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
    await this.db.create('Relation2', [
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
      const row = await this.db.findOne('TableFour', {
        where: { id: 'test0' },
        include: { relation1: { relation2: true } },
      })
      assert.equal(typeof row.relation1, 'object')
      assert.equal(row.relation1.relation2.id, 'test0')
    }
    {
      const row = await this.db.findOne('TableFour', {
        where: { id: 'test0' },
        include: { relation1: true },
      })
      assert.equal(typeof row.relation1, 'object')
      assert.equal(typeof row.relation1.relation2, 'undefined')
    }
  })

  test('should count documents', async () => {
    const table = 'Table5'
    await this.db.create(table, [
      { id: 0 },
      { id: 1, optionalField: true },
      { id: 2, optionalField: true },
      { id: 3, optionalField: true },
    ])
    assert.equal(await this.db.count(table, {}), 4)
    assert.equal(await this.db.count(table, { id: 1 }), 1)
    assert.equal(await this.db.count(table, { id: [0, 2] }), 2)
    assert.equal(await this.db.count(table, { optionalField: true }), 3)
    assert.equal(await this.db.count(table, { optionalField: false }), 0)
    assert.equal(await this.db.count(table, { optionalField: null }), 1)
  })

  test('should handle object type', async () => {
    const table = 'Table6'
    await this.db.create(table, [
      {
        id: 0,
        boolField: true,
        stringField: 'test',
        objectField: { test: 'obj' },
      },
    ])
    const row = await this.db.findOne(table, { where: { id: 0 } })
    assert.equal(typeof row.objectField, 'object')
    assert.equal(row.objectField.test, 'obj')
  })

  test('should perform update', async () => {
    const table = 'Table6'
    await this.db.create(table, [
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
      const row = await this.db.findOne(table, { where: { id: 0 } })
      assert.equal(typeof row.objectField, 'object')
      assert.equal(row.objectField.test, 'obj')
      assert.equal(row.boolField, true)
      assert.equal(row.stringField, 'test')
    }
    const changes = await this.db.update(table, {
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
      const row = await this.db.findOne(table, { where: { id: 0 } })
      assert.equal(typeof row.objectField, 'object')
      assert.equal(row.objectField.newProp, 'exists')
      assert.equal(row.boolField, false)
      assert.equal(row.stringField, 'newTest')
    }
  })

  test('should perform upsert', async () => {
    const table = 'Table6'
    {
      const doc = await this.db.upsert(table, {
        where: { id: 0 },
        create: {
          id: 0,
          boolField: true,
          stringField: 'test',
          objectField: { test: 'obj' },
        },
        update: {},
      })
      assert.equal(doc.stringField, 'test')
      assert.equal(doc.objectField.test, 'obj')
    }
    {
      const doc = await this.db.upsert(table, {
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
      assert.equal(doc.boolField, false)
    }
  })

  test('should not upsert if empty update', async () => {
    const table = 'Table6'
    {
      const doc = await this.db.upsert(table, {
        where: { id: 0 },
        create: {
          id: 0,
          boolField: true,
          stringField: 'test',
          objectField: { test: 'obj' },
        },
        update: {},
      })
      assert.equal(doc.id, 0)
    }
    {
      const doc = await this.db.upsert(table, {
        where: { id: 0 },
        create: {
          id: 0,
          boolField: false,
        },
        update: {},
      })
      assert.equal(doc.boolField, true)
    }
  })

  test('should use operators', async () => {
    const table = 'TableTwo'
    for (let x = 0; x < 10; x++) {
      await this.db.create(table, {
        counterField: x,
      })
      await new Promise(r => setTimeout(r, 10))
    }
    {
      const docs = await this.db.findMany(table, {
        where: {
          counterField: { lt: 3 },
        },
      })
      assert.equal(docs.length, 3)
    }
    {
      const docs = await this.db.findMany(table, {
        where: {
          counterField: { lte: 3 },
        },
      })
      assert.equal(docs.length, 4)
    }
    {
      const docs = await this.db.findMany(table, {
        where: {
          counterField: { gt: 3 },
        },
      })
      assert.equal(docs.length, 6)
    }
    {
      const docs = await this.db.findMany(table, {
        where: {
          counterField: { gte: 3 },
        },
      })
      assert.equal(docs.length, 7)
    }
    {
      const docs = await this.db.findMany(table, {
        where: {
          counterField: { ne: 3 },
        },
      })
      assert.equal(docs.length, 9)
    }
  })

  test('should use OR logic', async () => {
    const table = 'TableTwo'
    for (let x = 0; x < 10; x++) {
      await this.db.create(table, {
        counterField: x,
      })
      await new Promise(r => setTimeout(r, 10))
    }
    {
      const docs = await this.db.findMany(table, {
        where: {
          OR: [{ counterField: 0 }, { counterField: 1 }],
        },
      })
      assert.equal(docs.length, 2)
    }
    {
      const docs = await this.db.findMany(table, {
        where: {
          OR: [{ counterField: 0 }, { counterField: 1 }],
          counterField: { gt: 5 },
        },
      })
      assert.equal(docs.length, 0)
    }
    {
      const docs = await this.db.findMany(table, {
        where: {
          OR: [{ counterField: { gt: 5 } }, { counterField: 1 }],
        },
      })
      assert.equal(docs.length, 5)
    }
  })
}
