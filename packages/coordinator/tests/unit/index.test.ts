/* eslint-disable jest/no-hooks */
import { nSQL, InanoSQLInstance } from '@nano-sql/core'
import Web3 from 'web3'
import path from 'path'
import * as compose from 'docker-compose'
import { WebsocketProvider } from 'web3-core'
import { FullNode } from '~core'
import { schema } from '~database'
import { Coordinator } from '~coordinator'
import { ZkAccount } from '~account'
import { keys } from '~testnet'
import { sleep } from '~testnet/utils'

describe('integration test to run testnet', () => {
  let fullNode: FullNode
  let coordinator: Coordinator
  let wsProvider: WebsocketProvider
  beforeAll(async () => {
    await compose.upAll({
      cwd: path.join(__dirname, '../../../'),
      log: true,
    })
    await sleep(2000)
    const dbName = 'coordinatorNode'
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
    wsProvider = new Web3.providers.WebsocketProvider('ws://127.0.0.1:5000')
    async function waitConnection() {
      return new Promise<void>(res => {
        if (wsProvider.connected) res()
        wsProvider.on('connect', res)
      })
    }
    await waitConnection()
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
    coordinator = new Coordinator(fullNode, {
      maxBytes: 131072,
      bootstrapNode: true,
      priceMultiplier: 48, // 32 gas is the current default price for 1 byte
      db,
      apiPort: 8888,
    })
  }, 10000)
  afterAll(async () => {
    console.log('down')
    wsProvider.disconnect(0, 'close connection')
    await compose.down({
      cwd: path.join(__dirname, '../../../'),
      log: true,
    })
  }, 10000)
  it('should be defined have one test', () => {
    console.log('run test')
    expect(fullNode).toBeDefined()
    expect(coordinator).toBeDefined()
  })
})
