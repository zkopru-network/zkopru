// import { schema } from '@zkopru/database'
import { nSQL, InanoSQLInstance } from '@nano-sql/core'
import { HDWallet, ZkAccount } from '~account'

describe('unit test', () => {
  let account: ZkAccount
  it('hDWallet', async () => {
    expect.hasAssertions()
    const database: InanoSQLInstance = nSQL()
    database.createDatabase({
      mode: 'TEMP',
      // tables: [schema.hdWallet],
    })
    const hdWallet = new HDWallet(database)
    // account = await hdWallet.createAccount(0)
    expect(hdWallet).toBeDefined()
    expect(account).toBeUndefined()
  })
})
