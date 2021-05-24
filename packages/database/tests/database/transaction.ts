/* eslint-disable jest/require-top-level-describe, jest/no-export */
import assert from 'assert'
import { DB } from '~database'

export default function(this: { db: DB }) {
  test('should execute transaction', async () => {
    const table = 'TableThree'
    const transactionPromise = this.db.transaction(db => {
      db.create(table, [
        {
          id: 'test0',
        },
        {
          id: 'test1',
        },
      ])
      db.update(table, {
        where: { id: 'test0' },
        update: { optionalField: 'test' },
      })
      db.upsert(table, {
        where: { id: 'test2' },
        create: { id: 'test2', optionalField: 'exists' },
        update: {},
      })
      db.upsert(table, {
        where: { id: 'test1' },
        create: { id: 'test1', optionalField: 'exists' },
        update: { optionalField: 'exists' },
      })
      db.upsert(table, {
        where: { id: 'test5' },
        create: { id: 'test5', optionalField: 'exists' },
        update: { optionalField: 'exists' },
      })
      db.delete(table, {
        where: { id: 'test5' },
      })
    })
    const createPromise = this.db
      .create(table, { id: 'test2' })
      .then(() => {
        // this promise should throw with a duplicate key violation
        assert(false)
      })
      .catch(() => assert(true))
    // Wait for database operations to complete, then see which promise rejected
    await Promise.all([transactionPromise, createPromise])
    const rows = await this.db.findMany(table, {
      where: {},
      orderBy: { id: 'asc' },
    })
    assert.equal(rows.length, 3)
    assert.equal(rows[0].optionalField, 'test')
    assert.equal(rows[1].optionalField, 'exists')
    assert.equal(rows[2].optionalField, 'exists')
  })

  test('should rollback transaction', async () => {
    const table = 'TableThree'
    try {
      await this.db.transaction(db => {
        db.create(table, {
          id: 'test0',
        })
        db.upsert(table, {
          where: { id: 'test1' },
          create: { id: 'test1', optionalField: 'exists' },
          update: { optionalField: 'exists' },
        })
        // now run an operation that SHOULD fail
        db.create(table, {
          id: 'test0',
        })
      })
      assert(false)
    } catch (err) {
      assert(true)
    }
    // No documents should exist
    const count = await this.db.count(table, {})
    assert.equal(count, 0)
  })

  test('should execute transactions callbacks on success', async () => {
    const table = 'TableThree'
    let committed = false
    let completed = false
    let errored = false
    const transactionPromise = this.db.transaction(db => {
      db.create(table, {
        id: 'test0',
      })
      db.onCommit(() => {
        committed = true
      })
      db.onComplete(() => {
        completed = true
      })
      db.onError(() => {
        errored = true
      })
    })
    assert(!committed)
    assert(!completed)
    assert(!errored)
    await transactionPromise
    assert(committed)
    assert(completed)
    assert(!errored)
  })

  test('should execute transactions callbacks on error', async () => {
    const table = 'TableThree'
    let committed = false
    let completed = false
    let errored = false
    const transactionPromise = this.db.transaction(db => {
      db.create(table, {
        id: null,
      })
      db.onCommit(() => {
        committed = true
      })
      db.onComplete(() => {
        completed = true
      })
      db.onError(() => {
        errored = true
      })
    })
    assert(!committed)
    assert(!completed)
    assert(!errored)
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    await transactionPromise.catch(() => {})
    assert(!committed)
    assert(completed)
    assert(errored)
  })

  test('should fail to register non-function callbacks', async () => {
    const table = 'TableThree'
    const transactionPromise = this.db.transaction(db => {
      db.create(table, {
        id: 'test0',
      })
      try {
        db.onCommit({} as any)
        assert(false)
      } catch (err) {
        assert.equal(
          err.toString(),
          'Error: Non-function onCommit callback supplied',
        )
      }
      try {
        db.onError({} as any)
        assert(false)
      } catch (err) {
        assert.equal(
          err.toString(),
          'Error: Non-function onError callback supplied',
        )
      }
      try {
        db.onComplete({} as any)
        assert(false)
      } catch (err) {
        assert.equal(
          err.toString(),
          'Error: Non-function onComplete callback supplied',
        )
      }
    })
    await transactionPromise
  })
}
