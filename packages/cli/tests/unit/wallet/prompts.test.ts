import fs from 'fs'
import OnSyncing from '../../../src/apps/wallet/prompts/menus/on-syncing'
import { AppMenu, Context } from '../../../src/apps/wallet/prompts'
import { getMockedZKWallet } from './mocksForConfigurator'
import {
  mockAccountDetail,
  mockDeposit,
  mockDepositEther,
  mockTopMenu,
} from './mocksForPrompts'
import { parseEther } from 'ethers/lib/utils'

jest.mock('../../../../utils/src/prompt')
// jest.mock('../../../../zk-wizard/src/zk-wallet-account')

describe('wallet', () => {
  jest.setTimeout(20000)

  let context: Context
  let option

  beforeAll(async () => {
    if (fs.existsSync('zkwallet-db')) {
      fs.unlinkSync('zkwallet-db')
    }

    let zkWallet = await getMockedZKWallet(
      './tests/wallet.test.json',
      handleAfter,
    )
    option = {
      base: zkWallet,
      onCancel: handleAfter,
    }

    zkWallet.node.start()
  })

  async function handleAfter() {
    if (fs.existsSync('zkwallet-db')) {
      fs.unlinkSync('zkwallet-db')
    }
  }

  afterEach(async () => {
    await handleAfter()
  })

  describe('top menu', () => {
    it('select an existing account', async () => {
      let mockedTopMenu = mockTopMenu(option)
      mockedTopMenu.ask.mockResolvedValue({ idx: 0 })
      const ret = await mockedTopMenu.run(context)

      expect(ret.next).toEqual(AppMenu.ACCOUNT_DETAIL)
      expect(ret.context.account).toBeDefined()
      expect(ret.context.account?.ethAddress).toEqual(
        '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1',
      )
    })

    it('exit', async () => {
      let mockedTopMenu = mockTopMenu(option)
      mockedTopMenu.ask.mockResolvedValue({ idx: -2 })
      const ret = await mockedTopMenu.run(context)

      expect(ret.next).toEqual(AppMenu.EXIT)
      // context is still undefined (it was not initialized in the beginning)
      expect(ret.context).toBeUndefined()
    })
  })

  describe('syncing', () => {
    let contextForSyncing
    beforeAll(async () => {
      let mockedTopMenu = mockTopMenu(option)
      mockedTopMenu.ask.mockResolvedValue({ idx: 0 })
      const ret = await mockedTopMenu.run(context)
      contextForSyncing = ret.context
    })

    it('select an existing account', async () => {
      let syncing = new OnSyncing(option)
      const ret = await syncing.run(contextForSyncing)

      expect(ret.next).toEqual(AppMenu.ACCOUNT_DETAIL)
      expect(ret.context.account).toBeDefined()
      expect(ret.context.account?.ethAddress).toEqual(
        '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1',
      )
    })
  })

  describe('account detail', () => {
    let contextForAccountDetail
    let mockedAccountDetail
    let balance

    beforeAll(async () => {
      let mockedTopMenu = mockTopMenu(option)
      mockedTopMenu.ask.mockResolvedValue({ idx: 0 })
      let ret = await mockedTopMenu.run(context)
      contextForAccountDetail = ret.context
      balance = await option.base.wallet.provider.getBalance(
        ret.context.account!.ethAddress,
      )
      mockedAccountDetail = mockAccountDetail(option)
    })

    it('select each menu', async () => {
      const choices = [
        AppMenu.TOP_MENU,
        AppMenu.DEPOSIT,
        AppMenu.TRANSFER,
        AppMenu.ATOMIC_SWAP,
        AppMenu.WITHDRAW_REQUEST,
        AppMenu.WITHDRAWABLE_LIST,
        -1, // unsupported value
      ]
      for (let choice of choices) {
        mockedAccountDetail.ask.mockResolvedValue({ choice: choice })
        const ret = await mockedAccountDetail.run(contextForAccountDetail)
        expect(ret.context.balance.eth).toEqual(balance)
        expect(ret.next).toEqual(choice)
      }
    })
  })

  describe('deposit', () => {
    let contextForDeposit
    let mockedDeposit

    beforeAll(async () => {
      let mockedTopMenu = mockTopMenu(option)
      mockedTopMenu.ask.mockResolvedValue({ idx: 0 })
      let ret = await mockedTopMenu.run(context)
      contextForDeposit = ret.context

      mockedDeposit = mockDeposit(option)
    })

    it('select each menu', async () => {
      const choices = [
        AppMenu.ACCOUNT_DETAIL,
        AppMenu.DEPOSIT_ETHER,
        -1, // unsupported value
      ]
      for (let choice of choices) {
        mockedDeposit.ask.mockResolvedValue({ choice: { menu: choice } })
        const ret = await mockedDeposit.run(contextForDeposit)
        expect(ret.context.address).toBeUndefined()
        expect(ret.next).toEqual(choice)
      }
    })

    // FIXME: to have ERC20 and ERC721
    it.skip('run', async () => {
      const choices = [AppMenu.DEPOSIT_ERC20, AppMenu.DEPOSIT_ERC721]
      for (let choice of choices) {
        mockedDeposit.ask.mockResolvedValue({ choice: { menu: choice } })
        const ret = await mockedDeposit.run(contextForDeposit)
        expect(ret.context.address).toBeDefined()
        expect(ret.context.address).toEqual(
          '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1',
        )
        expect(ret.next).toEqual(choice)
      }
    })
  })

  describe('deposit ETH', () => {
    let contextForDepositETH: Context
    let mockedDepositETH

    beforeAll(async () => {
      let mockedTopMenu = mockTopMenu(option)
      mockedTopMenu.ask.mockResolvedValue({ idx: 0 })
      let ret = await mockedTopMenu.run(context)
      let contextForAccountDetail = mockAccountDetail(option)
      contextForAccountDetail.ask.mockResolvedValue({
        choice: AppMenu.DEPOSIT,
      })
      ret = await contextForAccountDetail.run(ret.context)
      contextForDepositETH = ret.context

      mockedDepositETH = mockDepositEther(option)
    })
    beforeEach(async () => {
      jest.restoreAllMocks()
    })

    it('deposit ETH', async () => {
      mockedDepositETH.ask.mockResolvedValue({
        amount: 0.01,
        fee: 0.001,
        confirmed: true,
      })
      // mock depositEther here,
      // we only want to make sure depositEther was called with correct args
      // testing for creating an utxo or eth transfer should be covered in zk-wizard
      const spyDepositEth = jest.spyOn(option.base, 'depositEther')
      const spyDeposit = jest.spyOn(option.base, 'deposit')

      const ret = await mockedDepositETH.run(contextForDepositETH)
      expect(ret.next).toEqual(AppMenu.DEPOSIT)
      expect(spyDepositEth).toHaveBeenCalledWith(
        parseEther('0.01'),
        parseEther('0.001'),
      )
      expect(spyDeposit).toHaveBeenCalled()
    })

    it('deposit 0 ETH and 0 fee', async () => {
      mockedDepositETH.ask.mockResolvedValue({
        amount: 0,
        fee: 0,
        confirmed: true,
        tryAgain: true,
      })
      const spyDepositEth = jest.spyOn(option.base, 'depositEther')
      const spyDeposit = jest.spyOn(option.base, 'deposit')

      const ret = await mockedDepositETH.run(contextForDepositETH)
      expect(ret.next).toEqual(AppMenu.DEPOSIT)
      expect(spyDepositEth).toHaveBeenCalledWith(
        parseEther('0'),
        parseEther('0'),
      )
      expect(spyDeposit).not.toHaveBeenCalled()
    })

    it('Reject to confirm Eth deposit', async () => {
      mockedDepositETH.ask.mockResolvedValue({
        amount: 0.01,
        fee: 0.001,
        confirmed: false,
      })
      const spyDepositEth = jest.spyOn(option.base, 'depositEther')

      const ret = await mockedDepositETH.run(contextForDepositETH)
      expect(ret.next).toEqual(AppMenu.DEPOSIT)
      expect(spyDepositEth).not.toHaveBeenCalled()
    })

    it('Not retry while depositEther failed', async () => {
      mockedDepositETH.ask.mockResolvedValue({
        amount: 0,
        fee: 0,
        confirmed: true,
        tryAgain: false,
      })
      const spyDepositEth = jest.spyOn(option.base, 'depositEther')

      const ret = await mockedDepositETH.run(contextForDepositETH)
      expect(ret.next).toEqual(AppMenu.DEPOSIT_ETHER)
      expect(spyDepositEth).toHaveBeenCalled()
    })
  })
})
