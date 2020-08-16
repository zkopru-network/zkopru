import { Container } from 'node-docker-api/lib/container'
import Web3 from 'web3'
import { MockupDB, DB } from '~prisma'
import { ZkAccount, HDWallet } from '~account'
import { sleep, readFromContainer, logger, buildAndGetContainer } from '~utils'
import { L1Contract } from '~core'
import { Layer1 } from '~contracts'
import { IERC20 } from '~contracts/contracts/IERC20'
import { IERC721 } from '~contracts/contracts/IERC721'

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
  mockup: MockupDB
  contract: L1Contract
  erc20: IERC20
  erc721: IERC721
}

export type Provider = () => Context

export async function terminate(ctx: Provider) {
  const { layer1Container, circuitArtifactContainer, mockup } = ctx()
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
      async () => {
        await mockup.terminate()
      },
    ].map(task => task()),
  )
}

export async function initContext() {
  const layer1Container = await buildAndGetContainer({
    compose: [__dirname, '../../../../dockerfiles'],
    service: 'contracts-for-integration-test',
  })
  const circuitArtifactContainer = await buildAndGetContainer({
    compose: [__dirname, '../../../../dockerfiles'],
    service: 'circuits',
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
  logger.info(`Running testnet on ${containerIP}:5000`)
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
  logger.info(`Websocket connection with ${containerIP}:5000`)
  const web3 = new Web3(provider)
  const contract = new L1Contract(web3, zkopruAddress)
  const erc20 = Layer1.getERC20(web3, erc20Address)
  const erc721 = Layer1.getERC721(web3, erc721Address)
  const mockup = await DB.mockup()
  const hdWallet = new HDWallet(web3, mockup.db)
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
    mockup,
    contract,
    vks,
    erc20,
    erc721,
  }
}
