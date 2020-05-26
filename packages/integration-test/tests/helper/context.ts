import { Docker } from 'node-docker-api'
import { nSQL, InanoSQLInstance } from '@nano-sql/core'
import { Container } from 'node-docker-api/lib/container'
import Web3 from 'web3'
import { ZkAccount, HDWallet } from '~account'
import { schema } from '~database'
import { sleep, readFromContainer } from '~utils'
import { L1Contract } from '~core'
import ZkOPRUContract from '~contracts'
import { IERC20 } from '~contracts/contracts/IERC20'
import { IERC721 } from '~contracts/contracts/IERC721'
/**
import { ZkWizard } from '~zk-wizard'
import { Grove } from '~tree/grove'
import { poseidonHasher, keccakHasher } from '~tree/hasher'
 */

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
  vks: VKs
  web3: Web3
  zkopruAddress: string
  db: InanoSQLInstance
  contract: L1Contract
  erc20: IERC20
  erc721: IERC721
}

export type Provider = () => Context

export async function terminate(ctx: Provider) {
  const { layer1Container, circuitArtifactContainer } = ctx()
  await Promise.all(
    [
      async () => {
        await layer1Container.stop()
        await layer1Container.delete()
      },
      async () => {
        await circuitArtifactContainer.stop()
        await circuitArtifactContainer.delete()
      },
    ].map(task => task()),
  )
}

/**
const initZkWizard = async (name: string, account: ZkAccount) => {
  const zkopruId = uuid()
  const dbName = name
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
      schema.block(zkopruId),
    ], // TODO make the core package handle this
  })
  const db: InanoSQLInstance = nSQL().useDatabase(dbName)
  const grove = new Grove(zkopruId, db, {
    utxoTreeDepth: 31,
    withdrawalTreeDepth: 31,
    nullifierTreeDepth: 254,
    utxoSubTreeSize: 32,
    withdrawalSubTreeSize: 32,
    utxoHasher: poseidonHasher(31),
    withdrawalHasher: keccakHasher(31),
    nullifierHasher: keccakHasher(254),
    fullSync: true,
    forceUpdate: true,
    pubKeysToObserve: [account.pubKey],
    addressesToObserve: [account.address],
  })
  await grove.init()
  const wizard = new ZkWizard({
    db,
    grove,
    privKey: account.ethPK,
  })
  wizard.addCircuit()
}
*/

export async function initContext() {
  const docker = new Docker({ socketPath: '/var/run/docker.sock' })
  const layer1Container = await docker.container.create({
    Image: 'wanseob/zkopru-contract-integration-test:0.0.1',
    name: Math.random()
      .toString(36)
      .substring(2, 16),
    rm: true,
  })
  const circuitArtifactContainer = await docker.container.create({
    Image: 'wanseob/zkopru-circuits:0.0.1',
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
  const deployedERC20 = await readFromContainer(
    layer1Container,
    '/proj/build/deployed/TestERC20.json',
  )
  const deployedERC721 = await readFromContainer(
    layer1Container,
    '/proj/build/deployed/TestERC721.json',
  )
  const zkopruAddress = JSON.parse(deployed.toString()).address
  const erc20Address = JSON.parse(deployedERC20.toString()).address
  const erc721Address = JSON.parse(deployedERC721.toString()).address
  const status = await layer1Container.status()
  const containerIP = (status.data as {
    NetworkSettings: { IPAddress: string }
  }).NetworkSettings.IPAddress
  await sleep(2000)
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
  const getERC20 = ZkOPRUContract.asIERC20
  const getERC721 = ZkOPRUContract.asIERC721
  const erc20 = getERC20(web3, erc20Address)
  const erc721 = getERC721(web3, erc721Address)
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
  const hdWallet = new HDWallet(web3, db)
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
    erc20,
    erc721,
  }
}
