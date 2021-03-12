/* eslint-disable jest/require-top-level-describe, no-plusplus, jest/no-export */
import assert from 'assert'
import { DB } from '~database'

export default function(this: { db: DB }) {
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
    assert.equal(typeof changes, 'number')
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
      const changes = await this.db.upsert(table, {
        where: { id: 0 },
        create: {
          id: 0,
          boolField: true,
          stringField: 'test',
          objectField: { test: 'obj' },
        },
        update: {},
      })
      assert.equal(changes, 1)
      const doc = await this.db.findOne(table, { where: { id: 0 } })
      assert.equal(doc.stringField, 'test')
      assert.equal(doc.objectField.test, 'obj')
    }
    {
      const changes = await this.db.upsert(table, {
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
      assert.equal(changes, 1)
      const doc = await this.db.findOne(table, {
        where: { id: 0 },
      })
      assert.equal(doc.boolField, false)
    }
  })

  test('should not upsert if empty update', async () => {
    const table = 'Table6'
    {
      const changes = await this.db.upsert(table, {
        where: { id: 0 },
        create: {
          id: 0,
          boolField: true,
          stringField: 'test',
          objectField: { test: 'obj' },
        },
        update: {},
      })
      assert.equal(changes, 1)
      const doc = await this.db.findOne(table, {
        where: { id: 0 },
      })
      assert.equal(doc.id, 0)
    }
    {
      const changes = await this.db.upsert(table, {
        where: { id: 0 },
        create: {
          id: 0,
          stringField: 'test2',
          boolField: false,
          objectField: { test: 'obj2' },
        },
        update: {},
      })
      assert.equal(changes, 0)
      const doc = await this.db.findOne(table, {
        where: { id: 0 },
      })
      assert.equal(doc.boolField, true)
    }
  })
}
