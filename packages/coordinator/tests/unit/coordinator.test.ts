/**
 * @jest-environment node
 */
/* eslint-disable jest/no-hooks */
import Web3 from 'web3'
import { WebsocketProvider } from 'web3-core'
import { Container } from 'node-docker-api/lib/container'
import { FullNode } from '@zkopru/core'
import { Coordinator } from '~coordinator'
import { ZkAccount } from '~account'
import { readFromContainer, sleep, pullOrBuildAndGetContainer } from '~utils'
import { MockupDB, DB } from '~prisma'
import assert from 'assert'
import fetch from 'node-fetch'

describe('coordinator test to run testnet', () => {
  const accounts: ZkAccount[] = [
    new ZkAccount(Buffer.from('sample private key')),
  ]
  let address
  let container: Container
  let fullNode: FullNode
  let wsProvider: WebsocketProvider
  let mockup: MockupDB
  let coordinator: Coordinator
  beforeAll(async () => {
    // logStream.addStream(process.stdout)
    mockup = await DB.testMockup()
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
      db: mockup.db,
      accounts,
    })
  }, 36000)
  afterAll(async () => {
    await coordinator.stop()
    wsProvider.disconnect(0, 'close connection')
    await mockup.terminate()
    await container.stop()
    await container.delete()
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

  describe('api', () => {
    it('should send block number', async () => {
      const res = await fetch('http://localhost:9999', {
      	headers: {
          'Content-Type': 'application/json',
      	},
        body: JSON.stringify({
          id: 'test',
      	  method: 'l2_blockNumber',
      	  jsonrpc: '2.0',
        }),
      	method: 'POST',
      })
      const data = await res.json()
      assert.equal(isNaN(data.result), false)
    })
  })
})
