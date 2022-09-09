import fs from 'fs'
import OnSyncing from '../../../src/apps/wallet/prompts/menus/on-syncing'
import { AppMenu, Context } from '../../../src/apps/wallet/prompts'
import { getMockedZKWallet } from './mocksForConfigurator'
import {
  mockAccountDetail,
  mockDeposit,
  mockDepositEther,
  mockTopMenu,
  mockTransferEth,
  mockTransferMenu,
} from './mocksForPrompts'
import { parseEther } from 'ethers/lib/utils'
import { ZkAccount } from '@zkopru/account'
import { ZkWallet } from '@zkopru/zk-wizard'
import { sleep } from '@zkopru/utils'
import { Utxo, UtxoStatus, ZkAddress } from '@zkopru/transaction'
import TransferEth from '../../../src/apps/wallet/prompts/menus/account-detail-transfer-eth'

jest.mock('../../../../utils/src/prompt')
jest.mock('../../../../transaction/src/tx-builder')

describe('wallet', () => {
  jest.setTimeout(20000)

  let context: Context
  let option

  beforeAll(async () => {
    if (fs.existsSync('zkwallet-db')) {
      fs.unlinkSync('zkwallet-db')
    }

    let zkWallet: ZkWallet = await getMockedZKWallet(
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
    // if (fs.existsSync('zkwallet-db')) {
    //   fs.unlinkSync('zkwallet-db')
    // }
  }

  afterEach(async () => {
    await handleAfter()
  })
  afterAll(async () => {
    await option.base.node.stop()
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

    // TODO: can't support re-run case now
    it.skip('select to create a new account', async () => {
      let mockedTopMenu = mockTopMenu(option)
      mockedTopMenu.ask.mockResolvedValue({ idx: -1 })
      await mockedTopMenu.run(context)
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
      // only works for spyOn
      jest.restoreAllMocks()
    })

    it('deposit ETH', async () => {
      mockedDepositETH.ask.mockResolvedValue({
        amount: 0.01,
        fee: 0.001,
        confirmed: true,
      })
      let utxos = await option.base.getUtxos()
      let utxoLen = utxos.length

      const ret = await mockedDepositETH.run(contextForDepositETH)
      sleep(500)

      let cnt = 0
      do {
        utxos = await option.base.getUtxos()
        if (utxoLen > utxos.length) break
        if (++cnt > 5) break
        sleep(500)
      } while (true)
      expect(utxos.length).toBeGreaterThan(utxoLen)
      expect(ret.next).toEqual(AppMenu.DEPOSIT)
    })

    it('deposit ETH with 0 fee', async () => {
      mockedDepositETH.ask.mockResolvedValue({
        amount: 0.001,
        fee: 0,
        confirmed: true,
        tryAgain: true,
      })
      const spyDepositEth = jest.spyOn(option.base, 'depositEther')
      const spyDeposit = jest.spyOn(option.base, 'deposit')

      const ret = await mockedDepositETH.run(contextForDepositETH)
      expect(ret.next).toEqual(AppMenu.DEPOSIT)
      expect(spyDepositEth).toHaveBeenCalledWith(
        parseEther('0.001'),
        parseEther('0'),
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

  describe('transfer menu', () => {
    let contextForTransfer
    let mockedTransfer

    beforeAll(async () => {
      let mockedTopMenu = mockTopMenu(option)
      mockedTopMenu.ask.mockResolvedValue({ idx: 0 })
      let ret = await mockedTopMenu.run(context)
      contextForTransfer = ret.context

      mockedTransfer = mockTransferMenu(option)
    })

    it('select each menu', async () => {
      const choices = [
        AppMenu.ACCOUNT_DETAIL,
        AppMenu.TRANSFER_ETH,
        -1, // unsupported value
      ]
      for (let choice of choices) {
        mockedTransfer.ask.mockResolvedValue({ choice: { menu: choice } })
        const ret = await mockedTransfer.run(contextForTransfer)
        expect(ret.context.address).toBeUndefined()
        expect(ret.next).toEqual(choice)
      }
    })

    // FIXME: to have ERC20 and ERC721
    it.skip('run', async () => {
      const choices = [AppMenu.DEPOSIT_ERC20, AppMenu.DEPOSIT_ERC721]
      for (let choice of choices) {
        mockedTransfer.ask.mockResolvedValue({ choice: { menu: choice } })
        const ret = await mockedTransfer.run(contextForTransfer)
        expect(ret.context.address).toBeDefined()
        expect(ret.context.address).toEqual(
          '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1',
        )
        expect(ret.next).toEqual(choice)
      }
    })
  })

  describe.only('transfer ETH', () => {
    let contextForTransferETH: Context
    let mockedTransferETH

    function getFakeUtxo(status: UtxoStatus): Utxo {
      const zkAddr: ZkAddress = new ZkAddress(
        'KTPpjY6zjQnwKXUs1aQb7KHMdfmxwCQGnFT3b7cMyDWgoBoirHDhbc69QsHBHvQztHgrceN6YVf5BpVxX7c24TdNc85am',
      )
      const fakeUtxo: Utxo = Utxo.newEtherNote({
        owner: zkAddr,
        eth: parseEther('1').toString(),
        salt: '0x84dac2a7faad73dfa5793039beabff6f',
      })
      fakeUtxo.status = status
      return fakeUtxo
    }

    beforeAll(async () => {
      let mockedTopMenu = mockTopMenu(option)
      mockedTopMenu.ask.mockResolvedValue({ idx: 0 })
      let ret = await mockedTopMenu.run(context)
      let contextForAccountDetail = mockAccountDetail(option)
      contextForAccountDetail.ask.mockResolvedValue({
        choice: AppMenu.DEPOSIT,
      })
      ret = await contextForAccountDetail.run(ret.context)
      let mockedDepositETH = mockDepositEther(option)
      mockedDepositETH.ask.mockResolvedValue({
        amount: 0.1,
        fee: 0.0002,
        confirmed: true,
      })
      ret = await mockedDepositETH.run(ret.context)
      let mockedTransfer = mockTransferMenu(option)
      mockedTransfer.ask.mockResolvedValue({
        choice: { menu: AppMenu.TRANSFER_ETH },
      })
      ret = await mockedTransfer.run(ret.context)
      contextForTransferETH = ret.context
      mockedTransferETH = mockTransferEth(option)

      // create a new account as recipient
      await option.base.createAccount(1)
      // mock zkWallet.fetchPrice bcs it queries coordinator
      option.base.fetchPrice = jest.fn()
      option.base.fetchPrice.mockResolvedValue(100)
      // bcs fullnode was not launced, utxo status here is always NON_INCLUDED
      // that's why we need to mock one here.
      option.base.getSpendables = jest.fn()
      option.base.getSpendables.mockResolvedValue([
        getFakeUtxo(UtxoStatus.UNSPENT),
      ])
    })
    beforeEach(async () => {
      jest.restoreAllMocks()
    })

    it('transfer ETH', async () => {
      const accounts: ZkAccount[] = await option.base.retrieveAccounts()
      mockedTransferETH.ask.mockResolvedValue({
        zkAddress: accounts[1].zkAddress,
        amount: 0.01, // ETH
        fee: 1, // gwei
      })
      const spySendTx = jest.spyOn(option.base, 'sendTx')

      const ret = await mockedTransferETH.run(contextForTransferETH)
      expect(ret.next).toEqual(AppMenu.TRANSFER)
      expect(spySendTx).toHaveBeenCalled()
    })

    it('transfer 0 ETH', async () => {
      const accounts: ZkAccount[] = await option.base.retrieveAccounts()
      mockedTransferETH.ask.mockResolvedValue({
        zkAddress: accounts[1].zkAddress,
        amount: 0, // ETH
        fee: 1, // gwei
      })
      const spySendTx = jest.spyOn(option.base, 'sendTx')

      const ret = await mockedTransferETH.run(contextForTransferETH)
      expect(ret.next).toEqual(AppMenu.TRANSFER)
      expect(spySendTx).toHaveBeenCalled()
    })

    it('transfer ETH with 0 fee', async () => {
      const accounts: ZkAccount[] = await option.base.retrieveAccounts()
      mockedTransferETH.ask.mockResolvedValue({
        zkAddress: accounts[1].zkAddress,
        amount: 0.01, // ETH
        fee: 0, // gwei
      })
      const spySendTx = jest.spyOn(option.base, 'sendTx')

      const ret = await mockedTransferETH.run(contextForTransferETH)
      expect(ret.next).toEqual(AppMenu.TRANSFER)
      expect(spySendTx).toHaveBeenCalled()
    })

    it('failed to fetch price', async () => {
      option.base.fetchPrice.mockRestore()
      const transferEth = new TransferEth(option)
      await expect(transferEth.run(contextForTransferETH)).rejects.toThrow()
    })
  })
})
