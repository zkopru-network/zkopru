/* eslint-disable jest/no-hooks */
import { nSQL, InanoSQLInstance } from '@nano-sql/core'
import Web3 from 'web3'
import { Docker } from 'node-docker-api'
import { WebsocketProvider } from 'web3-core'
import { Container } from 'node-docker-api/lib/container'
import { ReadStream } from 'fs-extra'
import { LightNode, HttpBootstrapHelper } from '~core'
import { schema } from '~database'
import { ZkAccount } from '~account'
import { keys } from '~testnet'
import { sleep } from '~testnet/utils'

describe('integration test to run testnet', () => {
  const testName = 'lightnodetest'
  let address: string
  let container: Container
  let lightNode: LightNode
  let wsProvider: WebsocketProvider
  beforeAll(async () => {
    const docker = new Docker({ socketPath: '/var/run/docker.sock' })
    try {
      container = await docker.container.create({
        Image: 'zkopru:contract',
        name: testName,
        rm: true,
      })
    } catch {
      container = docker.container.get(testName)
    }
    await container.start()
    const stream: ReadStream = (await container.fs.get({
      path: '/proj/build/deployed/ZkOptimisticRollUp.json',
    })) as ReadStream
    const f = (await stream.read()).toString()
    const deployed = JSON.parse(f.slice(f.indexOf('{'), f.indexOf('}') + 1))
    address = deployed.address
    const status = await container.status()
    const containerIP = (status.data as {
      NetworkSettings: { IPAddress: string }
    }).NetworkSettings.IPAddress
    await sleep(2000)
    wsProvider = new Web3.providers.WebsocketProvider(
      `ws://${containerIP}:5000`,
    )
    async function waitConnection() {
      return new Promise<void>(res => {
        if (wsProvider.connected) res()
        wsProvider.on('connect', res)
      })
    }
    await waitConnection()
  }, 10000)
  afterAll(async () => {
    await container.kill()
    wsProvider.disconnect(0, 'close connection')
  }, 20000)
  describe('light node', () => {
    it('should be defined', async () => {
      const dbName = 'zkopruLightNodeTester'
      await nSQL().createDatabase({
        id: dbName,
        mode: 'TEMP',
        tables: [
          schema.utxo,
          schema.utxoTree,
          schema.withdrawal,
          schema.withdrawalTree,
          schema.migration,
          schema.deposit,
          schema.massDeposit,
          schema.chain,
          schema.keystore,
          schema.hdWallet,
        ],
        version: 3,
      })
      const db: InanoSQLInstance = nSQL().useDatabase(dbName)
      const accounts: ZkAccount[] = [
        new ZkAccount(Buffer.from(keys.alicePrivKey)),
      ]
      lightNode = await LightNode.new({
        provider: wsProvider,
        address,
        db,
        accounts,
        bootstrapHelper: new HttpBootstrapHelper('http://localhost:8888'),
        option: {
          header: true,
          deposit: true,
          migration: true,
          outputRollUp: true,
          withdrawalRollUp: true,
          nullifierRollUp: false, // Only for FULL NODE
          snark: false,
        },
      })
      expect(lightNode).toBeDefined()
    })
  })
})
