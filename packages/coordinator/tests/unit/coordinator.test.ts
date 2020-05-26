/* eslint-disable jest/no-hooks */
import { nSQL, InanoSQLInstance } from '@nano-sql/core'
import Web3 from 'web3'
import { WebsocketProvider } from 'web3-core'
import { Docker } from 'node-docker-api'
import { Container } from 'node-docker-api/lib/container'
import { FullNode } from '@zkopru/core'
import { schema } from '~database'
import { Coordinator } from '~coordinator'
import { ZkAccount } from '~account'
import { readFromContainer, sleep } from '~utils'
import { randomHex } from 'web3-utils'

describe('coordinator test to run testnet', () => {
  const testName = `${randomHex(32)}`
  const accounts: ZkAccount[] = [
    new ZkAccount(Buffer.from('sample private key')),
  ]
  let address
  let container: Container
  let fullNode: FullNode
  let wsProvider: WebsocketProvider
  let db: InanoSQLInstance
  let coordinator: Coordinator
  beforeAll(async () => {
    const docker = new Docker({ socketPath: '/var/run/docker.sock' })
    try {
      container = await docker.container.create({
        Image: 'wanseob/zkopru-contract:0.0.1',
        name: testName,
        rm: true,
      })
    } catch (err) {
      container = docker.container.get(testName)
    }
    await container.start()
    const file = await readFromContainer(
      container,
      '/proj/build/deployed/ZkOptimisticRollUp.json',
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
      { reconnect: { auto: true } },
    )
    async function waitConnection() {
      return new Promise<void>(res => {
        if (wsProvider.connected) res()
        wsProvider.on('connect', res)
      })
    }
    await waitConnection()
    const dbName = 'coordinatortest'
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
    db = nSQL().useDatabase(dbName)
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
  }, 60000)
  afterAll(async () => {
    await container.stop()
    await container.delete()
    wsProvider.disconnect(0, 'close connection')
  }, 60000)
  describe('coordinator', () => {
    it('should be defined', async () => {
      coordinator = new Coordinator(fullNode, accounts[0].ethAccount, {
        maxBytes: 131072,
        bootstrap: true,
        priceMultiplier: 48, // 32 gas is the current default price for 1 byte
        port: 8888,
      })
      expect(coordinator).toBeDefined()
    })
  })
})
