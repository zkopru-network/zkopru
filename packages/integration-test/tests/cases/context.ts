import { Container } from 'node-docker-api/lib/container'
import Web3 from 'web3'
import path from 'path'
import { WebsocketProvider, Account } from 'web3-core'
import { Address } from 'soltypes'
import { DB, SQLiteConnector, schema } from '~database'
import { ZkAccount, HDWallet } from '~account'
import { sleep, readFromContainer, buildAndGetContainer } from '~utils'
import { DEFAULT } from '~cli/apps/coordinator/config'
import { L1Contract, FullNode } from '~core'
import { Coordinator } from '~coordinator'
import { ZkWallet } from '~zk-wizard'
import { Layer1 } from '~contracts'
import { IERC20 } from '~contracts/contracts/IERC20'
import { IERC721 } from '~contracts/contracts/IERC721'
import { VerifyingKey } from '~zk-wizard/snark'

type VKs = { [nIn: number]: { [nOut: number]: VerifyingKey } }

export interface Context {
  layer1Container: Container
  circuitArtifactContainer: Container
  accounts: {
    coordinator: ZkAccount
    alice: ZkAccount
    bob: ZkAccount
    carl: ZkAccount
  }
  wallets: {
    alice: ZkWallet
    bob: ZkWallet
    carl: ZkWallet
    coordinator: ZkWallet
  }
  coordinator: Coordinator
  vks: VKs
  web3: Web3
  provider: WebsocketProvider
  zkopruAddress: string
  dbs: DB[]
  contract: L1Contract
  tokens: {
    erc20: {
      contract: IERC20
      address: string
    }
    erc721: {
      contract: IERC721
      address: string
    }
  }
}

export type CtxProvider = () => Context

export async function terminate(ctx: CtxProvider) {
  const {
    layer1Container,
    circuitArtifactContainer,
    dbs,
    coordinator,
    wallets,
    provider,
  } = ctx()
  provider.disconnect(0, 'exit')
  await Promise.all([
    coordinator.stop(),
    wallets.alice.node.stop(),
    wallets.bob.node.stop(),
    wallets.carl.node.stop(),
    wallets.coordinator.node.stop(),
  ])
  await Promise.all([dbs.map(db => db.close())])
  await Promise.all([
    await layer1Container.stop(),
    await circuitArtifactContainer.stop(),
  ])
  await Promise.all([
    await layer1Container.delete(),
    await circuitArtifactContainer.delete(),
  ])
}

async function getContainers(): Promise<{
  layer1Container: Container
  circuitArtifactContainer: Container
}> {
  const layer1Container = await buildAndGetContainer({
    compose: [__dirname, '../../../../dockerfiles'],
    service: 'contracts-for-integration-test',
  })
  const circuitArtifactContainer = await buildAndGetContainer({
    compose: [__dirname, '../../../../dockerfiles'],
    service: 'circuits',
  })
  return { layer1Container, circuitArtifactContainer }
}

async function getAddresses(
  layer1Container: Container,
): Promise<{
  zkopruAddress: string
  erc20Address: string
  erc721Address: string
}> {
  const deployed = await readFromContainer(
    layer1Container,
    '/proj/build/deployed/Zkopru.json',
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
  return { zkopruAddress, erc20Address, erc721Address }
}

async function getContainerIP(container: Container): Promise<string> {
  const status = await container.status()
  const containerIP = (status.data as {
    NetworkSettings: { IPAddress: string }
  }).NetworkSettings.IPAddress
  return containerIP
}

async function getWeb3(
  ws: string,
): Promise<{ web3: Web3; provider: WebsocketProvider }> {
  const provider = new Web3.providers.WebsocketProvider(ws, {
    reconnect: { auto: true },
  })
  async function waitConnection() {
    return new Promise<void>(res => {
      if (provider.connected) res()
      provider.on('connect', res)
    })
  }
  await waitConnection()
  const web3 = new Web3(provider)
  return { web3, provider }
}

async function getAccounts(
  web3: Web3,
): Promise<{
  alice: ZkAccount
  bob: ZkAccount
  carl: ZkAccount
  coordinator: ZkAccount
}> {
  const mockup = await SQLiteConnector.create(':memory:')
  await mockup.createTables(schema)
  const hdWallet = new HDWallet(web3, mockup)
  const mnemonic =
    'myth like bonus scare over problem client lizard pioneer submit female collect'
  await hdWallet.init(mnemonic, 'samplepassword')
  const coordinator = await hdWallet.createAccount(0)
  const alice = await hdWallet.createAccount(1)
  const bob = await hdWallet.createAccount(2)
  const carl = await hdWallet.createAccount(3)
  const accounts = { coordinator, alice, bob, carl }
  await mockup.close()
  return accounts
}

async function getVKs(circuitArtifactContainer: Container): Promise<VKs> {
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
              `/proj/build/vks/zk_transaction_${i}_${j}.vk.json`,
            )
          ).toString('utf8'),
        )
        vks[i][j] = vk
      }
      readVKs.push(readVK)
    })
  })
  await Promise.all(readVKs.map(f => f()))
  return vks
}

async function getCoordinator(
  provider: WebsocketProvider,
  address: string,
  account: Account,
): Promise<{ coordinator: Coordinator; mockupDB: DB }> {
  const mockupDB = await SQLiteConnector.create(':memory:')
  await mockupDB.createTables(schema)
  const fullNode: FullNode = await FullNode.new({
    address,
    provider,
    db: mockupDB,
  })
  const { maxBytes, priceMultiplier, port } = DEFAULT
  const coordinator = new Coordinator(fullNode, account, {
    maxBytes,
    priceMultiplier, // 32 gas is the current default price for 1 byte
    vhosts: '*',
    port,
    maxBid: 20000,
    bootstrap: false,
    vhosts: '*',
  })
  return { coordinator, mockupDB }
}

export async function getWallet({
  account,
  provider,
  coordinator,
  erc20s,
  erc721s,
  address,
}: {
  account: ZkAccount
  provider: WebsocketProvider
  coordinator: string
  address: string
  erc20s: string[]
  erc721s: string[]
}): Promise<{ zkWallet: ZkWallet; mockupDB: DB }> {
  const mockupDB = await SQLiteConnector.create(':memory:')
  await mockupDB.createTables(schema)
  const node: FullNode = await FullNode.new({
    address,
    provider,
    db: mockupDB,
    slasher: account.ethAccount,
  })
  const web3 = new Web3(provider)
  const hdWallet = new HDWallet(web3, mockupDB)
  const zkWallet = new ZkWallet({
    db: mockupDB,
    wallet: hdWallet,
    node,
    accounts: [account],
    erc20: erc20s.map(Address.from),
    erc721: erc721s.map(Address.from),
    coordinator,
    snarkKeyPath: path.join(__dirname, '../../../circuits/keys'),
  })
  zkWallet.setAccount(account)
  return { zkWallet, mockupDB }
}

async function getWallets({
  accounts,
  config,
}: {
  accounts: {
    alice: ZkAccount
    bob: ZkAccount
    carl: ZkAccount
    coordinator: ZkAccount
  }
  config: {
    provider: WebsocketProvider
    coordinator: string
    address: string
    erc20s: string[]
    erc721s: string[]
  }
}): Promise<{
  wallets: {
    alice: ZkWallet
    bob: ZkWallet
    carl: ZkWallet
    coordinator: ZkWallet
  }
  dbs: DB[]
}> {
  const { zkWallet: alice, mockupDB: aliceDB } = await getWallet({
    account: accounts.alice,
    ...config,
  })
  const { zkWallet: bob, mockupDB: bobDB } = await getWallet({
    account: accounts.bob,
    ...config,
  })
  const { zkWallet: carl, mockupDB: carlDB } = await getWallet({
    account: accounts.carl,
    ...config,
  })
  const { zkWallet: coordinator, mockupDB: coordinatorDB } = await getWallet({
    account: accounts.coordinator,
    ...config,
  })
  return {
    wallets: { alice, bob, carl, coordinator },
    dbs: [aliceDB, bobDB, carlDB, coordinatorDB],
  }
}

export async function initContext(): Promise<Context> {
  const { layer1Container, circuitArtifactContainer } = await getContainers()
  await Promise.all([layer1Container.start(), circuitArtifactContainer.start()])
  const { zkopruAddress, erc20Address, erc721Address } = await getAddresses(
    layer1Container,
  )
  await sleep(2000)
  const containerIP = await getContainerIP(layer1Container)
  const { web3, provider } = await getWeb3(`ws://${containerIP}:5000`)
  const contract = new L1Contract(web3, zkopruAddress)
  const erc20 = Layer1.getERC20(web3, erc20Address)
  const erc721 = Layer1.getERC721(web3, erc721Address)
  const accounts = await getAccounts(web3)
  const vks = await getVKs(circuitArtifactContainer)
  // await getCircuitArtifacts(circuitArtifactContainer)
  const { coordinator, mockupDB: coordinatorDB } = await getCoordinator(
    provider,
    zkopruAddress,
    accounts.coordinator.ethAccount,
  )
  await coordinator.start()
  const { wallets, dbs } = await getWallets({
    accounts,
    config: {
      provider,
      coordinator: `http://localhost:${coordinator.context.config.port}`,
      address: zkopruAddress,
      erc20s: [erc20Address],
      erc721s: [erc721Address],
    },
  })
  wallets.alice.node.start()
  wallets.bob.node.start()
  wallets.carl.node.start()
  wallets.coordinator.node.start()

  return {
    layer1Container,
    circuitArtifactContainer,
    accounts,
    web3,
    provider,
    zkopruAddress,
    dbs: [...dbs, coordinatorDB],
    contract,
    coordinator,
    wallets,
    vks,
    tokens: {
      erc20: { contract: erc20, address: erc20Address },
      erc721: { contract: erc721, address: erc721Address },
    },
  }
}
