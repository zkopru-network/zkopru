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

  test('should catch creation type errors', async () => {
    const table = 'Table7'
    try {
      await this.db.create(table, {
        id: 0,
        boolField: '0',
        stringField: 'test',
        objectField: {},
      })
      assert(false)
    } catch (err) {
      assert(/Unrecognized value .* for type Bool/.test(err.toString()))
    }
    try {
      await this.db.create(table, {
        id: 0,
        boolField: 0,
        stringField: 'test',
        objectField: {},
      })
      assert(false)
    } catch (err) {
      assert(/Unrecognized value .* for type Bool/.test(err.toString()))
    }
    try {
      await this.db.create(table, {
        id: 0,
        boolField: {},
        stringField: 'test',
        objectField: {},
      })
      assert(false)
    } catch (err) {
      assert(/Unrecognized value .* for type Bool/.test(err.toString()))
    }
    try {
      await this.db.create(table, {
        id: true,
        boolField: true,
        stringField: 'test',
        objectField: {},
      })
      assert(false)
    } catch (err) {
      assert(/Unrecognized value .* for type Int/.test(err.toString()))
    }
    try {
      await this.db.create(table, {
        id: {},
        boolField: true,
        stringField: 'test',
        objectField: {},
      })
      assert(false)
    } catch (err) {
      assert(/Unrecognized value .* for type Int/.test(err.toString()))
    }
    try {
      await this.db.create(table, {
        id: 'test',
        boolField: true,
        stringField: 'test',
        objectField: {},
      })
      assert(false)
    } catch (err) {
      assert(/Unrecognized value .* for type Int/.test(err.toString()))
    }
    try {
      await this.db.create(table, {
        id: 0,
        boolField: true,
        stringField: 0,
        objectField: {},
      })
      assert(false)
    } catch (err) {
      assert(/Unrecognized value .* for type String/.test(err.toString()))
    }
    try {
      await this.db.create(table, {
        id: 0,
        boolField: true,
        stringField: {},
        objectField: {},
      })
      assert(false)
    } catch (err) {
      assert(/Unrecognized value .* for type String/.test(err.toString()))
    }
    try {
      await this.db.create(table, {
        id: 0,
        boolField: true,
        stringField: true,
        objectField: {},
      })
      assert(false)
    } catch (err) {
      assert(/Unrecognized value .* for type String/.test(err.toString()))
    }
    try {
      await this.db.create(table, {
        id: 0,
        boolField: true,
        stringField: 'test',
        objectField: 'test',
      })
      assert(false)
    } catch (err) {
      assert(/Unrecognized value .* for type Object/.test(err.toString()))
    }
    try {
      await this.db.create(table, {
        id: 0,
        boolField: true,
        stringField: 'test',
        objectField: true,
      })
      assert(false)
    } catch (err) {
      assert(/Unrecognized value .* for type Object/.test(err.toString()))
    }
    try {
      await this.db.create(table, {
        id: 0,
        boolField: true,
        stringField: 'test',
        objectField: 0,
      })
      assert(false)
    } catch (err) {
      assert(/Unrecognized value .* for type Object/.test(err.toString()))
    }
  })
}
