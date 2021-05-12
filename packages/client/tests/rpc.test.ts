/* eslint-disable jest/no-hooks */
import assert from 'assert'
import Web3 from 'web3'
import { WebsocketProvider } from 'web3-core'
import { Container } from 'node-docker-api/lib/container'
import { FullNode } from '@zkopru/core'
import Zkopru from '../src'
import { Coordinator } from '~coordinator'
import { ZkAccount } from '~account'
import { sleep } from '~utils'
import { readFromContainer, pullOrBuildAndGetContainer } from '~utils-docker'
import { DB, SQLiteConnector, schema } from '~database-node'

describe('rPC tests', () => {
  const accounts: ZkAccount[] = [
    new ZkAccount(Buffer.from('sample private key')),
  ]
  let address
  let container: Container
  let fullNode: FullNode
  let wsProvider: WebsocketProvider
  let mockup: DB
  let coordinator: Coordinator
  const coordinators = [] as Coordinator[]
  const rpc = new Zkopru.RPC('http://127.0.0.1:9999')
  // setup a coordinator node to query
  beforeAll(async () => {
    // logStream.addStream(process.stdout)
    mockup = await SQLiteConnector.create(schema, ':memory:')
    // It may take about few minutes. If you want to skip building image,
    // run `yarn pull:images` on the root directory
    container = await pullOrBuildAndGetContainer({
      compose: [__dirname, '../../../dockerfiles'],
      service: 'contracts',
    })
    await container.start()
    const file = await readFromContainer(
      container,
      '/proj/build/deployed/Zkopru.json',
    )
    const deployed = JSON.parse(file.toString())
    address = deployed.address
    const status = await container.status()
    const containerIP = (status.data as {
      NetworkSettings: { IPAddress: string }
    }).NetworkSettings.IPAddress
    // const containerIP = '127.0.0.1'
    await sleep(3000)
    wsProvider = new Web3.providers.WebsocketProvider(
      `ws://${containerIP}:5000`,
      {
        reconnect: { auto: true },
        clientConfig: {
          keepalive: true,
          keepaliveInterval: 10000,
        },
      },
    )
    async function waitConnection() {
      return new Promise<void>(res => {
        if (wsProvider.connected) return res()
        wsProvider.on('connect', res)
      })
    }
    await waitConnection()
    fullNode = await FullNode.new({
      provider: wsProvider,
      address,
      db: mockup,
      accounts,
    })
    coordinator = new Coordinator(fullNode, accounts[0].ethAccount, {
      maxBytes: 131072,
      bootstrap: true,
      priceMultiplier: 48, // 32 gas is the current default price for 1 byte
      maxBid: 20000,
      port: 9999,
      vhosts: '*',
      publicUrls: '127.0.0.1:9999',
    })
    await coordinator.start()
  }, 1200000)

  afterAll(async () => {
    await coordinator.stop()
    wsProvider.disconnect(0, 'close connection')
    await mockup.close()
    await container.stop()
    await container.delete()
    for (const c of coordinators) {
      await c.stop()
    }
  }, 10000)

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
  }, 20000)

  it.todo('should get transaction by hash')

  it('should get passthrough web3 instance', async () => {
    const { web3 } = rpc
    const blockNumber = await web3.eth.getBlockNumber()
    assert(typeof blockNumber === 'number')
  })
})
