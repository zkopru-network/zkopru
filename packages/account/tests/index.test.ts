/* eslint-disable jest/no-hooks */
import { ethers } from 'ethers'
import { HDWallet, ZkAccount } from '~account'
import { DB, SQLiteConnector, schema } from '~database/node'

describe('unit test', () => {
  let mockup: DB
  beforeAll(async () => {
    mockup = await SQLiteConnector.create(schema, ':memory:')
  })
  afterAll(async () => {
    await mockup.close()
  })
  it('has same private keys and eth address with ganache default accounts', async () => {
    const hdWallet = new HDWallet(ethers.getDefaultProvider(), mockup)
    await hdWallet.init(
      'myth like bonus scare over problem client lizard pioneer submit female collect',
      'samplepassword',
    )
    const accounts: ZkAccount[] = []
    await Promise.all(
      Array(10)
        .fill(0)
        .map((_, i) => async () => {
          accounts[i] = await hdWallet.createAccount(i)
        })
        .map(f => f()),
    )
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
      accounts.map(account => account.ethAddress),
    )
  }, 90000)
})
