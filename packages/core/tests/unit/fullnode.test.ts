/* eslint-disable jest/no-hooks */
import { nSQL, InanoSQLInstance } from '@nano-sql/core'
import Web3 from 'web3'
import { WebsocketProvider } from 'web3-core'
import { Docker } from 'node-docker-api'
import { Container } from 'node-docker-api/lib/container'
import { FullNode } from '~core'
import { schema } from '~database'
import { ZkAccount } from '~account'
import { keys } from '~testnet'
import { sleep } from '~testnet/utils'

describe('integration test to run testnet', () => {
  const testName = 'fullnodetest'
  let container: Container
  let fullNode: FullNode
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
  describe('full node', () => {
    it('should be defined', async () => {
      const dbName = 'zkopruFullNodeTester'
      await nSQL().createDatabase({
        id: dbName,
        mode: 'TEMP',
        tables: [
          schema.utxo,
          schema.utxoTree,
          schema.withdrawal,
          schema.withdrawalTree,
          schema.nullifiers,
          schema.nullifierTreeNode,
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
      const address = '0xaD888d0Ade988EbEe74B8D4F39BF29a8d0fe8A8D'
      const accounts: ZkAccount[] = [
        new ZkAccount(Buffer.from(keys.alicePrivKey)),
      ]
      fullNode = await FullNode.new({
        provider: wsProvider,
        address,
        db,
        accounts,
        option: {
          header: true,
          deposit: true,
          migration: true,
          outputRollUp: true,
          withdrawalRollUp: true,
          nullifierRollUp: true, // Only for FULL NODE
          snark: true,
        },
      })
      expect(fullNode).toBeDefined()
    })
  })
})
