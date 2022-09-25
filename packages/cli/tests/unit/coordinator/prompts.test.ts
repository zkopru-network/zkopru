import { BigNumber, ethers } from 'ethers'
import { parseEther, parseUnits } from 'ethers/lib/utils'
import { BaseProvider } from '@ethersproject/providers'
import { SQLiteConnector } from '@zkopru/database/dist/node'
import { FullNode, L1Contract, NetworkStatus } from '@zkopru/core'
import { Coordinator } from '@zkopru/coordinator'
import { ZkWalletAccount } from '@zkopru/zk-wizard'
import { schema } from '@zkopru/database'
import { ZkAccount } from '@zkopru/account'
import { BurnAuction__factory } from '@zkopru/contracts'
import { sleep } from '@zkopru/utils'
import { loadConfig } from '../../utils'
import {
  mockAuctionMenu,
  mockRefund,
  mockRegisterVk,
  mockSetupMenu,
  mockTopMenu,
  mockUpdateMaxBid,
  mockUpdateUrl,
} from './mocksForPrompts'
import { Context, AppMenu } from '../../../src/apps/coordinator/prompts'
import { Config } from '../../../src/apps/coordinator/configurator/configurator'
import ConnectWeb3 from '../../../src/apps/coordinator/configurator/config-prompts/connect-web3'
import ConfigureAccount from '../../../src/apps/coordinator/configurator/config-prompts/config-account'
import LoadDatabase from '../../../src/apps/coordinator/configurator/config-prompts/load-database'
import LoadCoordinator from '../../../src/apps/coordinator/configurator/config-prompts/load-coordinator'
import CompleteSetup from '../../../src/apps/coordinator/prompts/setup/complete-setup'
import CommitDeposits from '../../../src/apps/coordinator/prompts/setup/commit-deposits'
import RegisterAsCoordinator from '../../../src/apps/coordinator/prompts/setup/register-as-coordinator'
import Deregister from '../../../src/apps/coordinator/prompts/setup/deregister'
import AutoCoordinate from '../../../src/apps/coordinator/prompts/auto-coordinate'
import StopAutoCoordination from '../../../src/apps/coordinator/prompts/stop-auto-coordinate'
import Refund from '../../../src/apps/coordinator/prompts/auction/refund'

const COORDINATOR_CONFIG = './tests/coordinator.test.json'
const ADDR_ZKOPRU_CONTRACT = '0x970e8f18ebfEa0B08810f33a5A40438b9530FBCF'
const PRIVATE_KEY =
  '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d'

describe('prompts', () => {
  jest.setTimeout(25000)

  let context: Context
  let option
  let provider: BaseProvider

  async function depositEther(): Promise<boolean> {
    const zkAccount = new ZkAccount(PRIVATE_KEY, provider)
    const node = await FullNode.new({
      provider,
      address: ADDR_ZKOPRU_CONTRACT,
      db: await SQLiteConnector.create(schema, './tests/wallet-db-temp.db'),
      accounts: [zkAccount],
    })

    const wallet = new ZkWalletAccount({
      privateKey: PRIVATE_KEY,
      node: node,
      snarkKeyPath: '../circuits/keys',
      // TODO: pre-written list or retrieve from remote
      erc20: [],
      erc721: [],
    })

    return await wallet.depositEther(
      parseEther('0.01'),
      parseUnits('1', 'gwei'),
    )
  }

  async function getCoordinator(): Promise<Coordinator> {
    const config = loadConfig(COORDINATOR_CONFIG) as Config
    const optionForCoordinator = {
      base: config,
      onCancel: handleAfter,
    }
    const contextForCoordinator = {
      networkStatus: NetworkStatus.STOPPED,
    }
    const connection = new ConnectWeb3(optionForCoordinator)
    let ret = await connection.run(contextForCoordinator)
    const configureAccount = new ConfigureAccount(optionForCoordinator)
    ret = await configureAccount.run(ret.context)
    const db = new LoadDatabase(optionForCoordinator)
    ret = await db.run(ret.context)
    const coordinator = new LoadCoordinator(optionForCoordinator)
    ret = await coordinator.run(ret.context)
    return ret.context.coordinator!
  }

  beforeAll(async () => {
    context = {
      temp: 0,
    }
    option = {
      base: await getCoordinator(),
      onCancel: handleAfter,
    }
    const config = loadConfig(COORDINATOR_CONFIG) as Config
    provider = new ethers.providers.JsonRpcProvider(config.provider)
  })

  async function handleAfter() {}

  afterEach(async () => {
    await handleAfter()
  })

  describe('TopMenu', () => {
    it('select each menu', async () => {
      const codes = [
        AppMenu.PRINT_STATUS,
        AppMenu.LAYER1_DETAIL,
        AppMenu.COORDINATOR_INFO,
        AppMenu.AUCTION_INFO,
        AppMenu.AUTO_COORDINATE,
        AppMenu.STOP_AUTO_COORDINATION,
        AppMenu.AUCTION_MENU,
        AppMenu.SETUP_MENU,
        AppMenu.EXIT,
        -1, // unsupported value
      ]
      const mockedTopMenu = mockTopMenu(option)

      for (let code of codes) {
        mockedTopMenu.ask.mockResolvedValue({ code: code })
        const ret = await mockedTopMenu.run(context)
        expect(ret.next).toEqual(code)
      }
    })
  })

  describe('SetupMenu', () => {
    it('select each menu', async () => {
      const codes = [
        AppMenu.TOP_MENU,
        AppMenu.REGISTER_AS_COORDINATOR,
        AppMenu.DEREGISTER,
        AppMenu.COMPLETE_SETUP,
        AppMenu.REGISTER_VK,
        -1, // unsupported value
      ]
      const mockedMenu = mockSetupMenu(option)

      for (let code of codes) {
        mockedMenu.ask.mockResolvedValue({ code: code })
        const ret = await mockedMenu.run(context)
        expect(ret.next).toEqual(code)
      }
    })
  })

  describe.skip('RegisterVk', () => {
    const vkPath = '../circuits/keys/vks/zk_transaction_1_1.vk.json'
    it('register verification keys', async () => {
      const mockedRegisterVk = mockRegisterVk(option)
      // path.join(vkPath, `zk_transaction_${i}_${j}.vk.json`)
      mockedRegisterVk.ask.mockResolvedValue({
        chosenPath: vkPath,
        nIn: 4,
        nOut: 4,
      })

      const ret = await mockedRegisterVk.run(context)
      expect(ret.next).toEqual(AppMenu.SETUP_MENU)
    })
  })

  describe.skip('CompleteSetup', () => {
    it('complete setup', async () => {
      const completeSetup = new CompleteSetup(option)
      const ret = await completeSetup.run(context)
      expect(ret.next).toEqual(AppMenu.SETUP_MENU)
    })
  })

  describe('CommitDeposits', () => {
    it('commit mass deposit', async () => {
      const l1Contract = new L1Contract(provider, ADDR_ZKOPRU_CONTRACT)
      const eventFilter = l1Contract.coordinator.filters.MassDepositCommit()
      const from = await provider.getBlockNumber()

      expect(await depositEther()).toBe(true)

      const deposit = new CommitDeposits(option)
      const ret = await deposit.run(context)
      expect(ret.next).toEqual(AppMenu.SETUP_MENU)

      const events = await l1Contract.coordinator.queryFilter(
        eventFilter,
        from,
        await provider.getBlockNumber(),
      )
      expect(events.length).toBe(1)
    })
  })

  describe('RegisterAsCoordinator/Deregister', () => {
    let l1Contract
    let eventFilter
    beforeAll(async () => {
      l1Contract = new L1Contract(provider, ADDR_ZKOPRU_CONTRACT)
      eventFilter = l1Contract.coordinator.filters.StakeChanged()
    })

    it('register as a coordinator', async () => {
      const register = new RegisterAsCoordinator(option)
      const ret = await register.run(context)
      expect(ret.next).toEqual(AppMenu.SETUP_MENU)
      const blockNumber = await provider.getBlockNumber()

      const events = await l1Contract.coordinator.queryFilter(
        eventFilter,
        blockNumber,
        blockNumber,
      )
      expect(events.length).toBe(1)
      const config = loadConfig(COORDINATOR_CONFIG) as Config
      expect(events[0].args[0].toLocaleLowerCase().slice(2)).toEqual(
        config.keystore!['address'],
      )
      const isProposable = await l1Contract.coordinator.isProposable(
        config.keystore!['address'],
      )
      expect(isProposable).toBe(true)
    })

    it('deregister as a coordinator', async () => {
      const deregister = new Deregister(option)
      const ret = await deregister.run(context)
      expect(ret.next).toEqual(AppMenu.SETUP_MENU)
      const blockNumber = await provider.getBlockNumber()

      const events = await l1Contract.coordinator.queryFilter(
        eventFilter,
        blockNumber,
        blockNumber,
      )
      expect(events.length).toBe(1)
      const config = loadConfig(COORDINATOR_CONFIG) as Config
      expect(events[0].args[0].toLocaleLowerCase().slice(2)).toEqual(
        config.keystore!['address'],
      )
      const isProposable = await l1Contract.coordinator.isProposable(
        config.keystore!['address'],
      )
      expect(isProposable).toBe(false)
    })
  })

  describe('AutoCoordinate/StopAutoCoordination', () => {
    it('start coordinator', async () => {
      let flag = false
      option.base.on('start', () => {
        flag = true
      })

      const coordinate = new AutoCoordinate(option)
      const ret = await coordinate.run(context)

      expect(ret.next).toEqual(AppMenu.TOP_MENU)
      for (let i = 0; i < 5; i++) {
        if (flag) break
        sleep(100)
      }
      expect(flag).toBe(true)
    })

    it('stop coordinator', async () => {
      let flag = false
      option.base.on('stop', () => {
        flag = true
      })

      const coordinate = new StopAutoCoordination(option)
      const ret = await coordinate.run(context)

      expect(ret.next).toEqual(AppMenu.TOP_MENU)
      for (let i = 0; i < 5; i++) {
        if (flag) break
        sleep(100)
      }
      expect(flag).toBe(true)
    })
  })

  describe('AuctionMenu', () => {
    it('select each menu', async () => {
      const codes = [
        AppMenu.TOP_MENU,
        AppMenu.AUCTION_UPDATE_URL,
        AppMenu.AUCTION_UPDATE_MAX_BID,
        AppMenu.AUCTION_REFUND,
        -1, // unsupported value
      ]
      const mockedAuctionMenu = mockAuctionMenu(option)

      for (let code of codes) {
        mockedAuctionMenu.ask.mockResolvedValue({ code: code })
        const ret = await mockedAuctionMenu.run(context)
        expect(ret.next).toEqual(code)
      }
    })
  })

  describe('UpdateUrl', () => {
    const NEW_URL = 'http://localhost:1234'

    it('update url', async () => {
      const mockedUpdateUrl = mockUpdateUrl(option)
      mockedUpdateUrl.ask.mockResolvedValue({
        url: NEW_URL,
        confirmed: true,
      })

      const ret = await mockedUpdateUrl.run(context)
      expect(ret.next).toEqual(AppMenu.TOP_MENU)

      const consensus = await option.base.layer1().zkopru.consensusProvider()
      const auction = BurnAuction__factory.connect(
        consensus,
        option.base.layer1().provider,
      )
      const newUrl = await auction.coordinatorUrls(
        await option.base.context.account.getAddress(),
      )
      expect(newUrl).toEqual(NEW_URL)
    })

    it('not to update url', async () => {
      const consensus = await option.base.layer1().zkopru.consensusProvider()
      const auction = BurnAuction__factory.connect(
        consensus,
        option.base.layer1().provider,
      )
      const originalUrl = await auction.coordinatorUrls(
        await option.base.context.account.getAddress(),
      )

      const mockedUpdateUrl = mockUpdateUrl(option)
      mockedUpdateUrl.ask.mockResolvedValue({
        url: NEW_URL,
        confirmed: false,
      })

      const ret = await mockedUpdateUrl.run(context)
      expect(ret.next).toEqual(AppMenu.AUCTION_MENU)
      const newUrl = await auction.coordinatorUrls(
        await option.base.context.account.getAddress(),
      )
      expect(newUrl).toEqual(originalUrl)
    })
  })

  describe('UpdateMaxBid', () => {
    it('update maxBid', async () => {
      const mockedUpdateMaxBid = mockUpdateMaxBid(option)
      mockedUpdateMaxBid.ask.mockResolvedValue({
        amount: '123',
      })

      const ret = await mockedUpdateMaxBid.run(context)
      expect(ret.next).toEqual(AppMenu.TOP_MENU)
      const { maxBid } = option.base.context.auctionMonitor
      expect(maxBid).toEqual(parseUnits('123', 'gwei'))
    })

    it('update maxBid with leading and trailing space', async () => {
      const mockedUpdateMaxBid = mockUpdateMaxBid(option)
      mockedUpdateMaxBid.ask.mockResolvedValue({
        amount: ' 12.3 ',
      })

      const ret = await mockedUpdateMaxBid.run(context)
      expect(ret.next).toEqual(AppMenu.TOP_MENU)
      const { maxBid } = option.base.context.auctionMonitor
      expect(maxBid).toEqual(parseUnits('12.3', 'gwei'))
    })
  })

  describe('Refund', () => {
    async function bid() {
      const consensus = await option.base.layer1().zkopru.consensusProvider()
      const auction = BurnAuction__factory.connect(
        consensus,
        option.base.layer1().provider,
      )
      const round = await auction.earliestBiddableRound()
      await (
        await auction
          .connect(option.base.context.account)
          ['bid(uint256)'](round, {
            value: await auction.minNextBid(round),
          })
      ).wait()
    }

    async function getPendingBalance(): Promise<BigNumber> {
      const consensus = await option.base.layer1().zkopru.consensusProvider()
      const auction = BurnAuction__factory.connect(
        consensus,
        option.base.layer1().provider,
      )
      return await auction.pendingBalances(
        await option.base.context.account.getAddress(),
      )
    }

    it('refund', async () => {
      await bid()
      let pendingBalance = await getPendingBalance()
      expect(pendingBalance.toString()).not.toEqual('0')

      const mockedRefund = mockRefund(option)
      mockedRefund.ask.mockResolvedValue({
        confirmed: true,
      })

      const ret = await mockedRefund.run(context)
      expect(ret.next).toEqual(AppMenu.TOP_MENU)
      pendingBalance = await getPendingBalance()
      expect(pendingBalance.toString()).toEqual('0')
    })

    it('not refund bcs no pending balance', async () => {
      const refund = new Refund(option)

      const ret = await refund.run(context)
      expect(ret.next).toEqual(AppMenu.TOP_MENU)
    })

    it('reject to refund', async () => {
      await bid()
      let pendingBalance = await getPendingBalance()
      expect(pendingBalance.toString()).not.toEqual('0')

      const mockedRefund = mockRefund(option)
      mockedRefund.ask.mockResolvedValue({
        confirmed: false,
      })

      const ret = await mockedRefund.run(context)
      expect(ret.next).toEqual(AppMenu.AUCTION_MENU)
      expect(pendingBalance).toEqual(await getPendingBalance())
    })
  })
})
