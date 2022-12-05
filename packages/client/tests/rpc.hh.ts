// import chai from 'chai'
import assert from 'assert'
import { FullNode } from '@zkopru/core'
import { Coordinator } from '~coordinator'
import { ZkAccount } from '~account'
import { sleep, trimHexToLength } from '~utils'
import { ethers } from 'hardhat'
import { deploy } from '~contracts-utils/deployer'
import { RpcType } from '~client/types'
import { DB, SQLiteConnector, schema } from '~database-node'
import Zkopru from '../src'
import { Wallet } from 'ethers'
// const { expect } = chai

describe('rPC tests', () => {
  let account: ZkAccount
  let address: string
  let fullNode: FullNode
  let mockup: DB
  let coordinator: Coordinator
  const coordinators = [] as Coordinator[]
  const rpc = new Zkopru.RPC({
    type: RpcType.http,
    url: 'http://127.0.0.1:9999',
    l1Provider: ethers.provider,
  })
  // setup a coordinator node to query
  before(async () => {
    account = new ZkAccount(
      trimHexToLength(Buffer.from('sample private key'), 64),
      '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1',
      new Wallet(
        trimHexToLength(Buffer.from('sample private key'), 64),
        ethers.provider,
      ),
    )
    // logStream.addStream(process.stdout)
    mockup = await SQLiteConnector.create(schema, ':memory:')
    // It may take about few minutes. If you want to skip building image,
    // run `yarn pull:images` on the root directory
    const [deployer] = await ethers.getSigners()
    const { zkopru } = await deploy(deployer)
    // logStream.addStream(process.stdout)
    mockup = await SQLiteConnector.create(schema, ':memory:')
    // It may take about few minutes. If you want to skip building image,
    // run `yarn pull:images` on the root directory
    address = zkopru.zkopru.address
    await sleep(3000)
    fullNode = await FullNode.new({
      provider: ethers.provider,
      address,
      db: mockup,
      accounts: [account],
    })
    coordinator = new Coordinator(fullNode, account.ethAccount!, {
      maxBytes: 131072,
      bootstrap: true,
      priceMultiplier: 48, // 32 gas is the current default price for 1 byte
      maxBid: 20000,
      port: 9999,
      vhosts: '*',
      publicUrls: '127.0.0.1:9999',
    })
    await coordinator.start()
  })

  after(async () => {
    await coordinator.stop()
    await mockup.close()
    for (const c of coordinators) {
      await c.stop()
    }
  })

  it('should fail with bad url', async () => {
    try {
      const tmp = new Zkopru.RPC('this is a bad url')
      // use tmp to avoid the "don't use new for side effects issue"
      assert(tmp)
      assert(false)
    } catch (err) {
      assert(true)
    }
  })

  it('should get address', async () => {
    const loadedAddress = await rpc.getAddress()
    const addressRegex = /^0x[A-Fa-f0-9]{40}$/
    assert(addressRegex.test(loadedAddress))
    assert.equal(loadedAddress, address)
  })

  it('should get sync status', async () => {
    const syncing = await rpc.syncing()
    assert(typeof syncing === 'boolean')
  })

  it('should get block count', async () => {
    const blockCount = await rpc.getBlockCount()
    assert(typeof blockCount === 'number')
  })

  it('should get block number', async () => {
    const blockNumber = await rpc.getBlockNumber()
    assert(typeof blockNumber === 'number')
  })

  it('should get block by index', async () => {
    const blockCount = await rpc.getBlockCount()
    const block = await rpc.getBlockByIndex(blockCount)
    assert.equal(block.proposalNum, blockCount)
  })

  it('should get block by number', async () => {
    const blockNumber = await rpc.getBlockNumber()
    const block = await rpc.getBlockByNumber(blockNumber)
    assert.equal((block as any).canonicalNum, blockNumber)
  })

  it('should get block by hash', async () => {
    const blockNumber = await rpc.getBlockNumber()
    const block = await rpc.getBlockByNumber(blockNumber)
    const blockByHash = await rpc.getBlockByHash(block.hash)
    assert.equal(block.hash, blockByHash.hash)
    assert.equal(block.proposalNum, blockByHash.proposalNum)
  })

  it('should fail to get invalid hash', async () => {
    try {
      await rpc.getBlockByHash('0xbadbadbadbad')
      assert(false)
    } catch (err) {
      assert(true)
    }
  })

  it('should get registered tokens', async () => {
    const tokens = await rpc.getRegisteredTokens()
    assert(Array.isArray(tokens.erc20s))
    assert(Array.isArray(tokens.erc721s))
  })

  it('should get verifying keys', async () => {
    const keys = await rpc.getVerifyingKeys()
    assert(keys)
  })

  it('should get transaction by hash')

  it('should get blockNumber', async () => {
    const { provider } = rpc
    const blockNumber = await provider.getBlockNumber()
    assert(typeof blockNumber === 'number')
  })
})
