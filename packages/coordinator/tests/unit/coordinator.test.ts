import chai from 'chai'
import assert from 'assert'
import fetch from 'node-fetch'
import { FullNode } from '~core'
import { Coordinator } from '~coordinator'
import { ZkAccount } from '~account'
import { trimHexToLength } from '~utils'
import { DB, SQLiteConnector, schema } from '~database/node'
import { ethers } from 'hardhat'
import { deploy } from '~contracts-utils/deployer'

const { expect } = chai

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
    new ZkAccount(
      trimHexToLength(Buffer.from('sample private key'), 64),
      ethers.provider,
    ),
  ]
  let address: string
  let fullNode: FullNode
  let mockup: DB
  let coordinator: Coordinator
  const coordinators = [] as Coordinator[]
  before(async () => {
    const [deployer] = await ethers.getSigners()
    const { zkopru } = await deploy(deployer)
    // logStream.addStream(process.stdout)
    mockup = await SQLiteConnector.create(schema, ':memory:')
    address = zkopru.zkopru.address
    fullNode = await FullNode.new({
      provider: ethers.provider,
      address,
      db: mockup,
      accounts,
    })
  })
  after(async () => {
    await coordinator.stop()
    await mockup.close()
    for (const c of coordinators) {
      await c.stop()
    }
  })
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
      expect(coordinator).to.not.be.undefined
      await coordinator.start()
    })
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
        expect(response.status).to.eq(401)
      }
      {
        const { response } = await callMethod({
          method: 'l2_blockNumber',
          jsonrpc: '2.0',
          url: 'http://localhost:10000',
        })
        expect(response.status).to.eq(200)
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
        expect(access, '')
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
        expect(access, 'http://test2.domain')
      }
    })
  })

  describe('api', () => {
    it('should fail with invalid rpc version', async () => {
      const { response, data } = await callMethod({
        method: 'l2_blockNumber',
        jsonrpc: '1.0',
      })
      expect(response.status).to.eq(400)
      expect(data.message, 'Invalid jsonrpc version')
    })

    it('should get l1 address', async () => {
      const { response, data } = await callMethod('l1_address')
      expect(response.status).to.eq(200)
      assert(/0x[a-fA-F0-9]/.test(data.result))
    })

    it('should determine if syncing', async () => {
      const { response, data } = await callMethod('l2_syncing')
      expect(response.status).to.eq(200)
      expect(typeof data.result).to.eq('boolean')
    })

    it('should get canonical block number', async () => {
      const { data } = await callMethod('l2_blockNumber')
      expect(Number.isNaN(data.result)).to.be.false
    })

    it('should get block count', async () => {
      const { data } = await callMethod('l2_blockCount')
      expect(Number.isNaN(data.result)).to.be.false
    })

    it('should get verifying keys', async () => {
      const { response, data } = await callMethod('l1_getVKs')
      expect(response.status).to.eq(200)
      expect(typeof data.result).to.eq('object')
    })

    it('should get genesis block', async () => {
      const { response, data } = await callMethod('l2_getBlockByNumber', 0)
      expect(response.status).to.eq(200)
      expect(+data.result.proposalNum).to.eq(0)
    })

    it('should get block by hash', async () => {
      // first get a hash
      const {
        data: {
          result: { hash },
        },
      } = await callMethod('l2_getBlockByNumber', 0)
      // then retrieve the block with that hash
      const { response, data } = await callMethod('l2_getBlockByHash', hash)
      expect(response.status).to.eq(200)
      expect(data.result.hash).to.eq(hash)
    })

    it('should get block by index', async () => {
      const { response, data } = await callMethod('l2_getBlockByIndex', 0)
      expect(response.status).to.eq(200)
      expect(data.result.proposalNum).to.eq('0x0')
    })

    it('should get block by canonical number', async () => {
      {
        const { response, data } = await callMethod(
          'l2_getBlockByNumber',
          0,
          false,
        )
        expect(response.status).to.eq(200)
        expect(data.result.proposalNum).to.eq('0x0')
        expect(data.result.uncleCount).to.eq('0x0')
      }
      {
        const { response, data } = await callMethod(
          'l2_getBlockByNumber',
          0,
          true,
        )
        expect(response.status).to.eq(200)
        expect(data.result.proposalNum).to.eq('0x0')
        expect(data.result.uncles).to.be.an.instanceOf(Array)
      }
    })

    it('should accept latest string', async () => {
      {
        const { response } = await callMethod('l2_getBlockByNumber', 'latest')
        expect(response.status).to.eq(200)
      }
      {
        const { response } = await callMethod('l2_getBlockByHash', 'latest')
        expect(response.status).to.eq(200)
      }
      {
        const { response } = await callMethod('l2_getBlockByIndex', 'latest')
        expect(response.status).to.eq(200)
      }
    })

    it('should get registered tokens', async () => {
      const { response, data } = await callMethod('l2_getRegisteredTokens')
      expect(response.status).to.eq(200)
      expect(data.result.erc20s).to.be.an.instanceOf(Array)
      expect(data.result.erc721s).to.be.an.instanceOf(Array)
    })

    it('should passthrough rpc request', async () => {
      const { response, data } = await callMethod('eth_blockNumber')
      expect(response.status).to.eq(200)
      assert(!Number.isNaN(data.result))
    })

    it('should passthrough rpc error', async () => {
      // sending incorrect number of args
      const { response, data } = await callMethod('eth_getBlockByNumber', 0xfff)
      expect(response.status).to.eq(400)
      assert(data.message)
    })

    it('should fail to call unknown method', async () => {
      const name = 'bad_method_call'
      const { response, data } = await callMethod(name)
      expect(response.status).to.eq(400)
      expect(data.message, `Invalid method: "${name}"`)
    })

    it('should return a transaction by hash')
  })
})
