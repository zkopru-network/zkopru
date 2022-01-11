/* eslint-disable jest/no-hooks, jest/valid-describe */
import assert from 'assert'
import testSchema from './test-schema'
import { DB, IndexedDBConnector } from '~database/web'
import FindTests from './database/find'
import CreateTests from './database/create'
import UpdateTests from './database/update'
import DeleteTests from './database/delete'
import TransactionTests from './database/transaction'

describe('indexedDB tests', function(this: any) {
  this.db = {} as DB
  beforeEach(async () => {
    this.db = await IndexedDBConnector.create(testSchema)
    for (const { name } of testSchema) {
      await this.db.delete(name, {
        where: {},
      })
    }
  })

  afterEach(async () => {
    await this.db.close()
  })

  FindTests.bind(this)()
  CreateTests.bind(this)()
  UpdateTests.bind(this)()
  DeleteTests.bind(this)()
  TransactionTests.bind(this)()

  it('should sort indexed query', async () => {
    const table = 'IndexTable'
    for (let x = 0; x < 10; x += 1) {
      await this.db.create(table, {
        id: x,
        id2: 10 - x,
      })
    }
    {
      const row = await this.db.findOne(table, {
        where: {
          id: [0, 1, 2],
          id2: [10, 9, 8],
        },
        orderBy: { id: 'asc' },
      })
      assert.equal(row.id, 0)
    }
    {
      const row = await this.db.findOne(table, {
        where: {
          id: [0, 1, 2],
          id2: [10, 9, 8],
        },
        orderBy: { id: 'desc' },
      })
      assert.equal(row.id, 2)
    }
  })
})
