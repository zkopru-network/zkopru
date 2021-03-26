/* eslint-disable jest/no-hooks, jest/valid-describe */
import testSchema from './test-schema'
import { DB, IndexedDBConnector } from '~database'
// import CreateTests from './database/create'
import 'fake-indexeddb/auto'

describe('indexedDB tests', function(this: any) {
  this.db = {} as DB
  beforeEach(async () => {
    this.db = await IndexedDBConnector.create(testSchema)
    // for (const { name } of testSchema) {
    //   await this.db.delete(name, {
    //     where: {},
    //   })
    // }
  })

  afterEach(async () => {
    await this.db.close()
  })

  it.todo('stub')

  // CreateTests.bind(this)()
})
