/* eslint-disable jest/no-hooks, jest/valid-describe */
import testSchema from './test-schema'
import { DB, SQLiteConnector } from '~database'
import DBTests from './database'

describe('sqlite tests', function(this: { db: DB }) {
  beforeEach(async () => {
    this.db = await SQLiteConnector.create(':memory:')
    await this.db.createTables(testSchema)
    for (const { name } of testSchema) {
      await this.db.deleteMany(name, {
        where: {},
      })
    }
  })

  afterEach(async () => {
    await this.db.close()
  })

  DBTests.bind(this)()
})
