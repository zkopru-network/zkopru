/* eslint-disable jest/no-hooks, jest/valid-describe */
import testSchema from './test-schema'
import { DB, DexieConnector } from '~database/web'
import FindTests from './database/find'
import CreateTests from './database/create'
import UpdateTests from './database/update'
import DeleteTests from './database/delete'
import TransactionTests from './database/transaction'

describe('dexie tests', function(this: any) {
  this.db = {} as DB
  beforeEach(async () => {
    this.db = await DexieConnector.create(testSchema)
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
