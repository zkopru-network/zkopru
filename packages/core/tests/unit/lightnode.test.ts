/**
 * @jest-environment node
 */
/* eslint-disable jest/no-hooks */
import Web3 from 'web3'
import { WebsocketProvider } from 'web3-core'
import { Container } from 'node-docker-api/lib/container'
import { DB, SQLiteConnector, schema } from '@zkopru/database'
import { ZkAccount } from '~account'
import { sleep, readFromContainer, pullOrBuildAndGetContainer } from '~utils'
import { LightNode, HttpBootstrapHelper } from '~core'

describe('integration test to run testnet', () => {
  const testName = 'lightnodetest'
  let address: string
  let container: Container
  let lightNode: LightNode
  let wsProvider: WebsocketProvider
  let mockup: DB
  beforeAll(async () => {
    mockup = await SQLiteConnector.create(':memory:')
    await mockup.createTables(schema)
    // It may take about few minutes. If you want to skip building image,
    // run `yarn pull:images` on the root directory
    container = await pullOrBuildAndGetContainer({
      compose: [__dirname, '../../../../dockerfiles'],
      service: 'contracts',
      option: { containerName: testName },
    })
    await container.start()
    const deployed = await readFromContainer(
      container,
      '/proj/build/deployed/Zkopru.json',
    )
    address = JSON.parse(deployed.toString()).address
    const status = await container.status()
    const containerIP = (status.data as {
      NetworkSettings: { IPAddress: string }
    }).NetworkSettings.IPAddress
    await sleep(2000)
    wsProvider = new Web3.providers.WebsocketProvider(
      `ws://${containerIP}:5000`,
      { reconnect: { auto: true } },
    )
    async function waitConnection() {
      return new Promise<void>(res => {
        if (wsProvider.connected) res()
        wsProvider.on('connect', res)
      })
    }
    await waitConnection()
  }, 3600000)
  afterAll(async () => {
    await container.stop()
    await container.delete()
    await mockup.close()
    wsProvider.disconnect(0, 'close connection')
  }, 20000)
  describe('light node', () => {
    it('should be defined', async () => {
      const accounts: ZkAccount[] = [
        new ZkAccount(Buffer.from('sample private key')),
      ]
      lightNode = await LightNode.new({
        provider: wsProvider,
        address,
        db: mockup,
        accounts,
        bootstrapHelper: new HttpBootstrapHelper('http://localhost:8888'),
      })
      expect(lightNode).toBeDefined()
    }, 60000)
  })
})
