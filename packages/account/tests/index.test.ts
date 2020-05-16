/* eslint-disable jest/no-hooks */
// import { schema } from '@zkopru/database'
import { nSQL, InanoSQLInstance } from '@nano-sql/core'
import Web3 from 'web3'
import { HDWallet, ZkAccount } from '~account'
import { schema } from '~database'

describe('unit test', () => {
  let database: InanoSQLInstance
  beforeAll(async () => {
    const dbName = 'hdwallet-test'
    await nSQL().createDatabase({
      id: dbName,
      mode: 'TEMP',
      tables: [schema.hdWallet, schema.keystore],
    })
    database = nSQL().useDatabase(dbName)
  })
  afterAll(async done => {
    await database.disconnect()
    done()
  })
  it('has same private keys and eth address with ganache default accounts', async () => {
    const web3 = new Web3()
    const hdWallet = new HDWallet(web3, database)
    await hdWallet.init(
      'myth like bonus scare over problem client lizard pioneer submit female collect',
      'samplepassword',
    )
    const accounts: ZkAccount[] = [
      await hdWallet.createAccount(0),
      await hdWallet.createAccount(1),
      await hdWallet.createAccount(2),
      await hdWallet.createAccount(3),
      await hdWallet.createAccount(4),
      await hdWallet.createAccount(5),
      await hdWallet.createAccount(6),
      await hdWallet.createAccount(7),
      await hdWallet.createAccount(8),
      await hdWallet.createAccount(9),
    ]
    const ganacheAddress = [
      '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1',
      '0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0',
      '0x22d491Bde2303f2f43325b2108D26f1eAbA1e32b',
      '0xE11BA2b4D45Eaed5996Cd0823791E0C93114882d',
      '0xd03ea8624C8C5987235048901fB614fDcA89b117',
      '0x95cED938F7991cd0dFcb48F0a06a40FA1aF46EBC',
      '0x3E5e9111Ae8eB78Fe1CC3bb8915d5D461F3Ef9A9',
      '0x28a8746e75304c0780E011BEd21C72cD78cd535E',
      '0xACa94ef8bD5ffEE41947b4585a84BdA5a3d3DA6E',
      '0x1dF62f291b2E969fB0849d99D9Ce41e2F137006e',
    ]
    expect(ganacheAddress).toStrictEqual(
      accounts.map(account => account.address),
    )
  })
})
