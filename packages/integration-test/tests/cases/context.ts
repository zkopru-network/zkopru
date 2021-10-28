import { Container } from 'node-docker-api/lib/container'
import Web3 from 'web3'
import fs from 'fs'
import path from 'path'
import { WebsocketProvider, Account } from 'web3-core'
import { Address } from 'soltypes'
import { DB, SQLiteConnector, schema } from '~database/node'
import { ZkAccount, HDWallet } from '~account'
import { sleep } from '~utils'
import { readFromContainer, pullAndGetContainer } from '~utils-docker'
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
    users: ZkAccount[]
  }
  wallets: {
    coordinator: ZkWallet
    alice: ZkWallet
    bob: ZkWallet
    carl: ZkWallet
    users: ZkWallet[]
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
  await Promise.all([
    coordinator.stop(),
    wallets.alice.node.stop(),
    wallets.bob.node.stop(),
    wallets.carl.node.stop(),
    wallets.coordinator.node.stop(),
    ...wallets.users.map(wallet => wallet.node.stop()),
  ])
  await new Promise(r => setTimeout(r, 20000))
  await Promise.all(dbs.map(db => db.close()))
  provider.disconnect(0, 'exit')
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
  const layer1Container = await pullAndGetContainer({
    compose: [__dirname, '../../../../compose'],
    service: 'contracts-for-integration-test',
  })
  const circuitArtifactContainer = await pullAndGetContainer({
    compose: [__dirname, '../../../../compose'],
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
    reconnect: {
      delay: 2000,
      auto: true,
    },
    clientConfig: {
      keepalive: true,
      keepaliveInterval: 30000,
    },
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

async function getAccounts(web3: Web3, n: number): Promise<ZkAccount[]> {
  const mockup = await SQLiteConnector.create(schema, ':memory:')
  const hdWallet = new HDWallet(web3, mockup)
  const mnemonic =
    'myth like bonus scare over problem client lizard pioneer submit female collect'
  await hdWallet.init(mnemonic, 'samplepassword')
  const accounts = await Promise.all(
    Array(n)
      .fill(undefined)
      .map((_, i) => hdWallet.createAccount(i)),
  )
  await mockup.close()
  return accounts
}
async function loadKeys(keyPath: string): Promise<VKs> {
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
          fs
            .readFileSync(
              path.join(keyPath, `zk_transaction_${i}_${j}.vk.json`),
            )
            .toString('utf8'),
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
  const mockupDB = await SQLiteConnector.create(schema, ':memory:')
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
    publicUrls: `localhost:${port}`,
    port,
    maxBid: 20000,
    bootstrap: false,
  })
  return { coordinator, mockupDB }
}

export async function getWallet({
  account,
  provider,
  erc20s,
  erc721s,
  address,
}: {
  account: ZkAccount
  provider: WebsocketProvider
  address: string
  erc20s: string[]
  erc721s: string[]
}): Promise<{ zkWallet: ZkWallet; mockupDB: DB }> {
  const mockupDB = await SQLiteConnector.create(schema, ':memory:')
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
    snarkKeyPath: path.join(__dirname, '../../../circuits/keys'),
  })
  zkWallet.setAccount(account)
  return { zkWallet, mockupDB }
}

async function getWallets({
  accounts,
  config,
}: {
  accounts: ZkAccount[]
  config: {
    provider: WebsocketProvider
    address: string
    erc20s: string[]
    erc721s: string[]
  }
}): Promise<{
  wallets: ZkWallet[]
  dbs: DB[]
}> {
  const results = await Promise.all(
    accounts.map(account => getWallet({ account, ...config })),
  )
  return {
    wallets: results.map(result => result.zkWallet),
    dbs: results.map(result => result.mockupDB),
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
  const accounts = await getAccounts(web3, 36)
  const vks = await loadKeys(path.join(__dirname, '../../../circuits/keys/vks'))
  const [coordinatorAccount] = accounts
  const { coordinator, mockupDB: coordinatorDB } = await getCoordinator(
    provider,
    zkopruAddress,
    coordinatorAccount.ethAccount,
  )
  await coordinator.start()
  const { wallets, dbs } = await getWallets({
    accounts,
    config: {
      provider,
      address: zkopruAddress,
      erc20s: [erc20Address],
      erc721s: [erc721Address],
    },
  })
  const [coordinatorWallet, aliceWallet, bobWallet, carlWallet] = wallets
  coordinatorWallet.node.start()
  aliceWallet.node.start()
  bobWallet.node.start()
  carlWallet.node.start()

  return {
    layer1Container,
    circuitArtifactContainer,
    accounts: {
      coordinator: accounts[0],
      alice: accounts[1],
      bob: accounts[2],
      carl: accounts[3],
      users: accounts.slice(4),
    },
    web3,
    provider,
    zkopruAddress,
    dbs: [...dbs, coordinatorDB],
    contract,
    coordinator,
    wallets: {
      coordinator: coordinatorWallet,
      alice: aliceWallet,
      bob: bobWallet,
      carl: carlWallet,
      users: wallets.slice(4),
    },
    vks,
    tokens: {
      erc20: { contract: erc20, address: erc20Address },
      erc721: { contract: erc721, address: erc721Address },
    },
  }
}
