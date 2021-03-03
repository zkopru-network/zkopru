/**
 * @jest-environment node
 */
/* eslint-disable jest/no-hooks */
import Web3 from 'web3'
import { WebsocketProvider } from 'web3-core'
import { Container } from 'node-docker-api/lib/container'
import { FullNode } from '@zkopru/core'
import assert from 'assert'
import fetch from 'node-fetch'
import { Coordinator } from '~coordinator'
import { ZkAccount } from '~account'
import { readFromContainer, sleep, pullOrBuildAndGetContainer } from '~utils'
import { DB, SQLiteConnector, schema } from '~database'

async function callMethod(
  _method:
    | string
    | {
        method: string
        jsonrpc?: string
        url?: string
        headers?: {}
      },
  ...params: any[]
) {
  let jsonrpc = '2.0'
  let method = _method
  let url = 'http://localhost:9999'
  const headers = {}
  if (typeof _method === 'object') {
    method = _method.method
    jsonrpc = _method.jsonrpc || jsonrpc
    url = _method.url || url
    Object.assign(headers, {
      ...(_method.headers || {}),
    })
  }
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({
      id: Math.floor(Math.random() * 10000).toString(),
      jsonrpc,
      method,
      params,
    }),
    method: 'POST',
  })
  return {
    data: await res.json(),
    response: res,
  }
}

describe('coordinator test to run testnet', () => {
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
  beforeAll(async () => {
    // logStream.addStream(process.stdout)
    mockup = await SQLiteConnector.create(':memory:')
    await mockup.createTables(schema as any)
    // It may take about few minutes. If you want to skip building image,
    // run `yarn pull:images` on the root directory
    container = await pullOrBuildAndGetContainer({
      compose: [__dirname, '../../../../dockerfiles'],
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
  }, 36000)
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
  describe('coordinator', () => {
    it('should be defined', async () => {
      coordinator = new Coordinator(fullNode, accounts[0].ethAccount, {
        maxBytes: 131072,
        bootstrap: true,
        priceMultiplier: 48, // 32 gas is the current default price for 1 byte
        maxBid: 20000,
        port: 9999,
        vhosts: '*',
        publicUrls: '127.0.0.1:9999',
      })
      expect(coordinator).toBeDefined()
      await coordinator.start()
    }, 20000)
  })

  describe('api host tests', () => {
    it('should restrict using vhosts', async () => {
      const coord = new Coordinator(fullNode, accounts[0].ethAccount, {
        maxBytes: 131072,
        bootstrap: true,
        priceMultiplier: 48, // 32 gas is the current default price for 1 byte
        maxBid: 20000,
        port: 10000,
        vhosts: 'localhost',
        publicUrls: '127.0.0.1:10000',
      })
      coordinators.push(coord)
      await coord.start()
      {
        const { response } = await callMethod({
          method: 'l2_blockNumber',
          jsonrpc: '2.0',
          url: 'http://127.0.0.1:10000',
        })
        assert.equal(response.status, 401)
      }
      {
        const { response } = await callMethod({
          method: 'l2_blockNumber',
          jsonrpc: '2.0',
          url: 'http://localhost:10000',
        })
        assert.equal(response.status, 200)
      }
    })

    it('should restrict using corsdomain', async () => {
      const coord = new Coordinator(fullNode, accounts[0].ethAccount, {
        maxBytes: 131072,
        bootstrap: true,
        priceMultiplier: 48, // 32 gas is the current default price for 1 byte
        maxBid: 20000,
        port: 10001,
        vhosts: '*',
        corsdomain: 'http://test.domain,http://test2.domain',
        publicUrls: '127.0.0.1:10000',
      })
      coordinators.push(coord)
      await coord.start()
      {
        const { response } = await callMethod({
          method: 'l2_blockNumber',
          jsonrpc: '2.0',
          url: 'http://localhost:10001',
          headers: {
            Origin: 'http://someotherdomain.com',
          },
        })
        const access = response.headers.get('access-control-allow-origin')
        assert.equal(access, '')
      }
      {
        const { response } = await callMethod({
          method: 'l2_blockNumber',
          jsonrpc: '2.0',
          url: 'http://localhost:10001',
          headers: {
            Origin: 'http://test2.domain',
          },
        })
        const access = response.headers.get('access-control-allow-origin')
        assert.equal(access, 'http://test2.domain')
      }
    })
  })

  describe('api', () => {
    it('should fail with invalid rpc version', async () => {
      const { response, data } = await callMethod({
        method: 'l2_blockNumber',
        jsonrpc: '1.0',
      })
      assert.equal(response.status, 400)
      assert.equal(data.message, 'Invalid jsonrpc version')
    })

    it('should get l1 address', async () => {
      const { response, data } = await callMethod('l1_address')
      assert.equal(response.status, 200)
      assert(/0x[a-fA-F0-9]/.test(data.result))
    })

    it('should determine if syncing', async () => {
      const { response, data } = await callMethod('l2_syncing')
      assert.equal(response.status, 200)
      assert.equal(typeof data.result, 'boolean')
    })

    it('should get canonical block number', async () => {
      const { data } = await callMethod('l2_blockNumber')
      assert.equal(Number.isNaN(data.result), false)
    })

    it('should get block count', async () => {
      const { data } = await callMethod('l2_blockCount')
      assert.equal(Number.isNaN(data.result), false)
    })

    it('should get verifying keys', async () => {
      const { response, data } = await callMethod('l1_getVKs')
      assert.equal(response.status, 200)
      assert.equal(typeof data.result, 'object')
    }, 15000)

    it('should get genesis block', async () => {
      const { data } = await callMethod('l2_getBlockByNumber', 0)
      assert.equal(+data.result.proposalNum, 0)
    })

    it('should get block by hash', async () => {
      // first get a hash
      const {
        data: { hash },
      } = await callMethod('l2_getBlockByNumber', 0)
      // then retrieve the block with that hash
      const { data } = await callMethod('l2_getBlockByHash', hash)
      assert.equal(data.hash, hash)
    })

    it('should get block by index', async () => {
      const { response, data } = await callMethod('l2_getBlockByIndex', 0)
      assert.equal(response.status, 200)
      assert.equal(data.result.proposalNum, 0)
    })

    it('should get block by canonical number', async () => {
      {
        const { response, data } = await callMethod(
          'l2_getBlockByNumber',
          0,
          false,
        )
        assert.equal(response.status, 200)
        assert.equal(data.result.proposalNum, 0)
        assert.equal(data.result.uncleCount, '0x0')
      }
      {
        const { response, data } = await callMethod(
          'l2_getBlockByNumber',
          0,
          true,
        )
        assert.equal(response.status, 200)
        assert.equal(data.result.proposalNum, 0)
        assert(Array.isArray(data.result.uncles))
      }
    })

    it('should accept latest string', async () => {
      {
        const { response } = await callMethod('l2_getBlockByNumber', 'latest')
        assert.equal(response.status, 200)
      }
      {
        const { response } = await callMethod('l2_getBlockByHash', 'latest')
        assert.equal(response.status, 200)
      }
      {
        const { response } = await callMethod('l2_getBlockByIndex', 'latest')
        assert.equal(response.status, 200)
      }
    })

    it('should get registered tokens', async () => {
      const { response, data } = await callMethod('l2_getRegisteredTokens')
      assert.equal(response.status, 200)
      assert(Array.isArray(data.result.erc20s))
      assert(Array.isArray(data.result.erc721s))
    })

    it('should passthrough web3 request', async () => {
      const { response, data } = await callMethod('eth_blockNumber')
      assert.equal(response.status, 200)
      assert(!Number.isNaN(data.result))
    })

    it('should passthrough web3 error', async () => {
      // sending incorrect number of args
      const { response, data } = await callMethod('eth_getBlockByNumber', 0xfff)
      assert.equal(response.status, 400)
      assert(data.message)
    })

    it('should fail to call unknown method', async () => {
      const name = 'bad_method_call'
      const { response, data } = await callMethod(name)
      assert.equal(response.status, 400)
      assert.equal(data.message, `Invalid method: "${name}"`)
    })

    it.todo('should return a transaction by hash')
  })
})
