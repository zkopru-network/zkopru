import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { JsonRpcProvider } from '@ethersproject/providers'
import fs from 'fs'
import path from 'path'
import { Address } from 'soltypes'
import { DB, SQLiteConnector, schema } from '~database/node'
import { ZkAccount, HDWallet } from '~account'
import { L1Contract, FullNode } from '~core'
import { Coordinator } from '~coordinator'
import { ZkWallet } from '~zk-wizard'
import { TestERC20, TestERC721, ZkopruContract } from '~contracts'
import { VerifyingKey } from '~zk-wizard/snark'
import { Signer } from 'ethers'
import { FixtureProvider } from './fixtures'
import { DEFAULT } from '~cli/apps/coordinator/config'

export interface TestFixture {
  deployer: SignerWithAddress
  testERC20: TestERC20
  testERC721: TestERC721
  zkopru: ZkopruContract
}

type VKs = { [nIn: string]: { [nOut: string]: VerifyingKey } }

export interface Context {
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
  provider: JsonRpcProvider
  zkopruAddress: string
  dbs: DB[]
  contract: L1Contract
  tokens: {
    erc20: {
      contract: TestERC20
      address: string
    }
    erc721: {
      contract: TestERC721
      address: string
    }
  }
  fixtureProvider: FixtureProvider
}

export type CtxProvider = () => Context

export async function terminate(ctx: CtxProvider) {
  const { dbs, coordinator, wallets, provider } = ctx()
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
  provider.removeAllListeners()
}

async function getAccounts(
  provider: JsonRpcProvider,
  n: number,
): Promise<ZkAccount[]> {
  const mockup = await SQLiteConnector.create(schema, ':memory:')
  const hdWallet = new HDWallet(provider, mockup)
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
  provider: JsonRpcProvider,
  address: string,
  account: Signer,
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
  provider: JsonRpcProvider
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
  const hdWallet = new HDWallet(provider, mockupDB)
  const zkWallet = new ZkWallet({
    db: mockupDB,
    wallet: hdWallet,
    node,
    accounts: [account],
    erc20: erc20s.map(Address.from),
    erc721: erc721s.map(Address.from),
    snarkKeyPath: path.join(__dirname, '../../circuits/keys'),
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
    provider: JsonRpcProvider
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
  const fixtureProvider = new FixtureProvider()
  const testFixtures = await fixtureProvider.getFixtures()
  const zkopruAddress = testFixtures.zkopru.zkopru.address
  const contract = new L1Contract(
    ethers.provider,
    testFixtures.zkopru.zkopru.address,
  )
  const erc20 = testFixtures.testERC20
  const erc721 = testFixtures.testERC721
  const accounts = await getAccounts(ethers.provider, 36)
  const vks = await loadKeys(path.join(__dirname, '../../circuits/keys/vks'))
  const [coordinatorAccount] = accounts
  const { coordinator, mockupDB: coordinatorDB } = await getCoordinator(
    ethers.provider,
    zkopruAddress,
    coordinatorAccount.ethAccount,
  )
  await coordinator.start()
  const { wallets, dbs } = await getWallets({
    accounts,
    config: {
      provider: ethers.provider,
      address: zkopruAddress,
      erc20s: [erc20.address],
      erc721s: [erc721.address],
    },
  })
  const [coordinatorWallet, aliceWallet, bobWallet, carlWallet] = wallets
  coordinatorWallet.node.start()
  aliceWallet.node.start()
  bobWallet.node.start()
  carlWallet.node.start()

  return {
    accounts: {
      coordinator: accounts[0],
      alice: accounts[1],
      bob: accounts[2],
      carl: accounts[3],
      users: accounts.slice(4),
    },
    provider: ethers.provider,
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
      erc20: { contract: erc20, address: erc20.address },
      erc721: { contract: erc721, address: erc721.address },
    },
    fixtureProvider,
  }
}
