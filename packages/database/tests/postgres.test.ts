/* eslint-disable jest/no-hooks, jest/valid-describe */
import testSchema from './test-schema'
import { DB, PostgresConnector } from '~database'
import DBTests from './database'

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

  DBTests.bind(this)()
})
