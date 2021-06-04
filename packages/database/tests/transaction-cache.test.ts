/* eslint-disable jest/no-hooks, jest/valid-describe */
import testSchema from './test-schema'
import { DB, SQLiteConnector } from '~database/node'
import TransactionCache from '../src/transaction-cache'
import FindTests from './database/find'
import CreateTests from './database/create'
import UpdateTests from './database/update'
import DeleteTests from './database/delete'
// import TransactionTests from './database/transaction'

describe('transaction cache tests', function(this: any) {
  this.db = {} as DB
  beforeEach(async () => {
    const rootDB = await SQLiteConnector.create(testSchema, ':memory:')
    this.db = new TransactionCache(rootDB)
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
  DeleteTests.bind(this)()
  UpdateTests.bind(this)()
})
