/* eslint-disable jest/no-hooks, jest/valid-describe */
import testSchema from './test-schema'
import { DB, PostgresConnector } from '~database'
import FindTests from './database/find'
import CreateTests from './database/create'
import UpdateTests from './database/update'
import DeleteTests from './database/delete'

describe('postgres tests', function(this: any) {
  this.db = {} as DB
  beforeEach(async () => {
    this.db = await PostgresConnector.create(
      'postgres://postgres:password@localhost:5432',
    )
    await this.db.createTables(testSchema)
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
})
