/* eslint-disable jest/no-hooks, jest/valid-describe */
import testSchema from './test-schema'
import { DB, IndexedDBConnector } from '~database-web'
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
})
