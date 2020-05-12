import { ZkAccount, HDWallet } from '@zkopru/account'
import { schema } from '@zkopru/database'
import { sleep, readFromContainer } from '@zkopru/utils'
import { L1Contract } from '@zkopru/core'
import { Docker } from 'node-docker-api'
import { nSQL, InanoSQLInstance } from '@nano-sql/core'
import { Container } from 'node-docker-api/lib/container'
import Web3 from 'web3'

type VKs = { [nIn: number]: { [nOut: number]: any } }

export interface Context {
  layer1Container: Container
  circuitArtifactContainer: Container
  accounts: {
    coordinator: ZkAccount
    alice: ZkAccount
    bob: ZkAccount
    carl: ZkAccount
  }
  web3: Web3
  zkopruAddress: string
  db: InanoSQLInstance
  contract: L1Contract
  vks: VKs
}

export type Provider = () => Context

export async function initContext() {
  const docker = new Docker({ socketPath: '/var/run/docker.sock' })
  const layer1Container = await docker.container.create({
    Image: 'zkopru:contract',
    name: Math.random()
      .toString(36)
      .substring(2, 16),
    rm: true,
  })
  const circuitArtifactContainer = await docker.container.create({
    Image: 'zkopru:circuits',
    name: Math.random()
      .toString(36)
      .substring(2, 16),
    rm: true,
  })
  await Promise.all([layer1Container.start(), circuitArtifactContainer.start()])
  const deployed = await readFromContainer(
    layer1Container,
    '/proj/build/deployed/ZkOptimisticRollUp.json',
  )
  const zkopruAddress = JSON.parse(deployed.toString()).address
  const status = await layer1Container.status()
  const containerIP = (status.data as {
    NetworkSettings: { IPAddress: string }
  }).NetworkSettings.IPAddress
  sleep(2000)
  console.log('Running testnet on ', `${containerIP}:5000`)
  const provider = new Web3.providers.WebsocketProvider(
    `ws://${containerIP}:5000`,
    { reconnect: { auto: true } },
  )
  async function waitConnection() {
    return new Promise<void>(res => {
      if (provider.connected) res()
      provider.on('connect', res)
    })
  }
  await waitConnection()
  console.log('Websocket connection with ', `${containerIP}:5000`)
  const web3 = new Web3(provider)
  const contract = new L1Contract(web3, zkopruAddress)
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
  const db = nSQL().useDatabase(dbName)
  const hdWallet = new HDWallet(db)
  const mnemonic =
    'myth like bonus scare over problem client lizard pioneer submit female collect'
  await hdWallet.init(mnemonic, 'samplepassword')
  const coordinator = await hdWallet.createAccount(0)
  const alice = await hdWallet.createAccount(1)
  const bob = await hdWallet.createAccount(2)
  const carl = await hdWallet.createAccount(3)
  const accounts = { coordinator, alice, bob, carl }
  const vks: VKs = {
    1: {},
    2: {},
    3: {},
    4: {},
  }
  const nIn = [1, 2, 3, 4]
  const nOut = [1, 2, 3, 4]
  const readVKs: (() => Promise<void>)[] = []
  nIn.forEach(i => {
    nOut.forEach(j => {
      const readVK = async () => {
        const vk = JSON.parse(
          (
            await readFromContainer(
              circuitArtifactContainer,
              '/proj/build/vks/zk_transaction_1_1.vk.json',
            )
          ).toString('utf8'),
        )
        vks[i][j] = vk
      }
      readVKs.push(readVK)
    })
  })
  await Promise.all(readVKs.map(f => f()))
  return {
    layer1Container,
    circuitArtifactContainer,
    accounts,
    web3,
    zkopruAddress,
    db,
    contract,
    vks,
  }
}
