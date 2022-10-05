import { BigNumber } from 'ethers'
import { parseEther, parseUnits } from 'ethers/lib/utils'
import { BurnAuction__factory } from '@zkopru/contracts'
import { sleep } from '@zkopru/utils'
import { loadConfig } from '../../utils'
import {
  mockAuctionMenu,
  mockRefund,
  mockSetupMenu,
  mockTopMenu,
  mockUpdateMaxBid,
  mockUpdateUrl,
} from './mocksForPrompts'
import { Context, AppMenu } from '../../../src/apps/coordinator/prompts'
import { Config } from '../../../src/apps/coordinator/configurator/configurator'
import CommitDeposits from '../../../src/apps/coordinator/prompts/setup/commit-deposits'
import RegisterAsCoordinator from '../../../src/apps/coordinator/prompts/setup/register-as-coordinator'
import Deregister from '../../../src/apps/coordinator/prompts/setup/deregister'
import AutoCoordinate from '../../../src/apps/coordinator/prompts/auto-coordinate'
import StopAutoCoordination from '../../../src/apps/coordinator/prompts/stop-auto-coordinate'
import Refund from '../../../src/apps/coordinator/prompts/auction/refund'
import { Context as NodeContext } from '../../context'
import { getCtx } from '../setupTest'

const COORDINATOR_CONFIG = './tests/coordinator.test.json'

describe('prompts', () => {
  jest.setTimeout(100000)

  let ctx: NodeContext
  let context: Context
  let option

  beforeAll(async () => {
    ctx = await getCtx()

    context = {
      temp: 0,
    }
    option = {
      base: ctx.coordinator,
      onCancel: handleAfter,
    }
    loadConfig(COORDINATOR_CONFIG) as Config
  })

  async function handleAfter() {}

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

  describe('CommitDeposits', () => {
    it('commit mass deposit', async () => {
      const l1Contract = ctx.contract
      const eventFilter = l1Contract.coordinator.filters.MassDepositCommit()
      const from = await ctx.provider.getBlockNumber()

      expect(
        await ctx.wallets.alice.depositEther(
          parseEther('0.01'),
          parseUnits('1', 'gwei'),
        ),
      ).toBe(true)

      const deposit = new CommitDeposits(option)
      const ret = await deposit.run(context)
      expect(ret.next).toEqual(AppMenu.SETUP_MENU)

      const events = await l1Contract.coordinator.queryFilter(
        eventFilter,
        from,
        await ctx.provider.getBlockNumber(),
      )
      expect(events.length).toBe(1)
    })
  })

  describe('RegisterAsCoordinator/Deregister', () => {
    let l1Contract
    let eventFilter
    beforeAll(async () => {
      l1Contract = ctx.contract
      eventFilter = l1Contract.coordinator.filters.StakeChanged()
    })

    it('register as a coordinator', async () => {
      const register = new RegisterAsCoordinator(option)
      const ret = await register.run(context)
      expect(ret.next).toEqual(AppMenu.SETUP_MENU)
      const blockNumber = await ctx.provider.getBlockNumber()

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
      const blockNumber = await ctx.provider.getBlockNumber()

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

      // stop coordinator first
      await ctx.coordinator.stop()
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

      // recovery
      await ctx.coordinator.start()
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
    async function bid(eth: string) {
      const consensus = await option.base.layer1().zkopru.consensusProvider()
      const auction = BurnAuction__factory.connect(consensus, ctx.provider)
      const round = await auction.earliestBiddableRound()
      await (
        await auction
          .connect(option.base.context.account)
          ['bid(uint256)'](round, {
            value: parseEther(eth),
          })
      ).wait()
    }

    async function getPendingBalance(): Promise<BigNumber> {
      const consensus = await option.base.layer1().zkopru.consensusProvider()
      const auction = BurnAuction__factory.connect(consensus, ctx.provider)
      return await auction.pendingBalances(
        await option.base.context.account.getAddress(),
      )
    }

    it('refund', async () => {
      await bid('0.001')
      await bid('0.002')
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
      await bid('0.003')
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
