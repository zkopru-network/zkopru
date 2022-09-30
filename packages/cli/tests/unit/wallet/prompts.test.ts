import fs from 'fs'
import OnSyncing from '../../../src/apps/wallet/prompts/menus/on-syncing'
import { AppMenu, Context } from '../../../src/apps/wallet/prompts'
import { getMockedZKWallet } from './mocksForConfigurator'
import {
  mockAccountDetail,
  mockAtomicSwap,
  mockAtomicSwapGiveEth,
  mockAtomicSwapTake,
  mockAtomicSwapTakeEth,
  mockDeposit,
  mockDepositEther,
  mockTopMenu,
  mockTransferEth,
  mockTransferMenu,
  mockWithdrawableList,
  mockWithdrawRequest,
  mockWithdrawRequestEth,
} from './mocksForPrompts'
import { parseEther, parseUnits } from 'ethers/lib/utils'
import { ZkAccount } from '@zkopru/account'
import { ZkWallet } from '@zkopru/zk-wizard'
import { SwapTxBuilder, Utxo, UtxoStatus, ZkAddress } from '@zkopru/transaction'
import TransferEth from '../../../src/apps/wallet/prompts/menus/account-detail-transfer-eth'
import Withdraw from '../../../src/apps/wallet/prompts/menus/account-detail-withdraw'

jest.mock('../../../../utils/src/prompt')

describe('wallet', () => {
  jest.setTimeout(20000)

  function getFakeUtxo(owner: ZkAddress, status: UtxoStatus): Utxo {
    const fakeUtxo: Utxo = Utxo.newEtherNote({
      owner: owner,
      eth: parseEther('1').toString(),
      salt: '0x84dac2a7faad73dfa5793039beabff6f',
    })
    fakeUtxo.status = status
    return fakeUtxo
  }

  function getFakeSwapTxBuilder(from: ZkAddress): SwapTxBuilder {
    const txBuilder = SwapTxBuilder.from(from)

    const spendables: Utxo[] = [getFakeUtxo(from, UtxoStatus.UNSPENT)]
    let swapTxBuilder = txBuilder
      .provide(...spendables.map(note => Utxo.from(note)))
      .weiPerByte(parseUnits('1', 'gwei'))

    return swapTxBuilder
  }

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
    await option.base.createAccount(1)
  })

  async function handleAfter() {}

  afterAll(async () => {
    await option.base.node.stop()
    if (fs.existsSync('zkwallet-db')) {
      fs.unlinkSync('zkwallet-db')
    }
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
      mockedDeposit.ask.mockResolvedValue({
        choice: { menu: AppMenu.DEPOSIT_ERC20 },
      })
      const ret = await mockedDeposit.run(contextForDeposit)
      expect(ret.context.address).toBeDefined()
      expect(ret.context.address).toEqual(
        '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1',
      )
      expect(ret.next).toEqual(AppMenu.DEPOSIT_ERC20)
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
      // mock deposit and depositEther here to save testing time
      const spyDepositEth = jest.spyOn(option.base, 'depositEther')
      const spyDeposit = jest
        .spyOn(option.base, 'deposit')
        .mockImplementation((() => {
          return true
        }) as any)

      const ret = await mockedDepositETH.run(contextForDepositETH)
      expect(ret.next).toEqual(AppMenu.DEPOSIT)
      expect(spyDepositEth).toHaveBeenCalledWith(
        parseEther('0.01'),
        parseEther('0.001'),
      )
      expect(spyDeposit).toHaveBeenCalled()
    })

    it('deposit ETH with 0 fee', async () => {
      mockedDepositETH.ask.mockResolvedValue({
        amount: 0.001,
        fee: 0,
        confirmed: true,
        tryAgain: true,
      })
      const spyDepositEth = jest.spyOn(option.base, 'depositEther')
      const spyDeposit = jest
        .spyOn(option.base, 'deposit')
        .mockImplementation((() => {}) as any)

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
      const spyDepositEth = jest
        .spyOn(option.base, 'depositEther')
        .mockImplementation((() => {}) as any)
      const spyDeposit = jest
        .spyOn(option.base, 'deposit')
        .mockImplementation((() => {}) as any)

      const ret = await mockedDepositETH.run(contextForDepositETH)
      expect(ret.next).toEqual(AppMenu.DEPOSIT)
      expect(spyDepositEth).toHaveBeenCalledWith(
        parseEther('0'),
        parseEther('0'),
      )
      expect(spyDeposit).not.toHaveBeenCalled()
    })

    it('deposit ETH and amount with leading and trailing space', async () => {
      mockedDepositETH.ask.mockResolvedValue({
        amount: ' 0.01 ',
        fee: ' 0.001 ',
        confirmed: true,
      })
      // mock deposit and depositEther here to save testing time
      const spyDepositEth = jest.spyOn(option.base, 'depositEther')
      const spyDeposit = jest
        .spyOn(option.base, 'deposit')
        .mockImplementation((() => {
          return true
        }) as any)

      const ret = await mockedDepositETH.run(contextForDepositETH)
      expect(ret.next).toEqual(AppMenu.DEPOSIT)
      expect(spyDepositEth).toHaveBeenCalledWith(
        parseEther('0.01'),
        parseEther('0.001'),
      )
      expect(spyDeposit).toHaveBeenCalled()
    })

    it('Reject to confirm Eth deposit', async () => {
      mockedDepositETH.ask.mockResolvedValue({
        amount: 0.01,
        fee: 0.001,
        confirmed: false,
      })
      const spyDepositEth = jest
        .spyOn(option.base, 'depositEther')
        .mockImplementation((() => {}) as any)

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
      const spyDepositEth = jest
        .spyOn(option.base, 'depositEther')
        .mockImplementation((() => {}) as any)

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

  describe('transfer ETH', () => {
    let contextForTransferETH: Context
    let mockedTransferETH

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

      const accounts: ZkAccount[] = await option.base.retrieveAccounts()
      // mock zkWallet.fetchPrice bcs it queries coordinator
      option.base.fetchPrice = jest.fn()
      option.base.fetchPrice.mockResolvedValue(100)
      // bcs fullnode was not launched, utxo status here is always NON_INCLUDED
      // that's why we need to mock one here.
      option.base.getSpendables = jest.fn()
      option.base.getSpendables.mockResolvedValue([
        getFakeUtxo(accounts[0].zkAddress, UtxoStatus.UNSPENT),
      ])
    })

    beforeEach(async () => {
      jest.restoreAllMocks()
    })

    it('transfer ETH', async () => {
      const accounts: ZkAccount[] = await option.base.retrieveAccounts()
      mockedTransferETH.ask.mockResolvedValue({
        zkAddress: accounts[1].zkAddress.toString(),
        amount: 0.01, // ETH
        fee: 1, // gwei
      })
      const spySendTx = jest
        .spyOn(option.base, 'sendTx')
        .mockImplementation((() => {}) as any)

      const ret = await mockedTransferETH.run(contextForTransferETH)
      expect(ret.next).toEqual(AppMenu.TRANSFER)
      expect(spySendTx).toHaveBeenCalled()
    })

    it('transfer 0 ETH', async () => {
      const accounts: ZkAccount[] = await option.base.retrieveAccounts()
      mockedTransferETH.ask.mockResolvedValue({
        zkAddress: accounts[1].zkAddress.toString(),
        amount: 0, // ETH
        fee: 1, // gwei
      })
      const spySendTx = jest
        .spyOn(option.base, 'sendTx')
        .mockImplementation((() => {}) as any)

      const ret = await mockedTransferETH.run(contextForTransferETH)
      expect(ret.next).toEqual(AppMenu.TRANSFER)
      expect(spySendTx).toHaveBeenCalled()
    })

    it('transfer ETH with 0 fee', async () => {
      const accounts: ZkAccount[] = await option.base.retrieveAccounts()
      mockedTransferETH.ask.mockResolvedValue({
        zkAddress: accounts[1].zkAddress.toString(),
        amount: 0.01, // ETH
        fee: 0, // gwei
      })
      const spySendTx = jest
        .spyOn(option.base, 'sendTx')
        .mockImplementation((() => {}) as any)

      const ret = await mockedTransferETH.run(contextForTransferETH)
      expect(ret.next).toEqual(AppMenu.TRANSFER)
      expect(spySendTx).toHaveBeenCalled()
    })

    it('transfer ETH and amount with leading and trailing space', async () => {
      const accounts: ZkAccount[] = await option.base.retrieveAccounts()
      mockedTransferETH.ask.mockResolvedValue({
        zkAddress: accounts[1].zkAddress.toString(),
        amount: ' 0.01 ', // ETH
        fee: ' 1 ', // gwei
      })
      const spySendTx = jest
        .spyOn(option.base, 'sendTx')
        .mockImplementation((() => {}) as any)

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

  describe('atomic swap', () => {
    let contextForAtomicSwap: Context
    let mockedAtomicSwap

    beforeAll(async () => {
      let mockedTopMenu = mockTopMenu(option)
      mockedTopMenu.ask.mockResolvedValue({ idx: 0 })
      let ret = await mockedTopMenu.run(context)
      let contextForAccountDetail = mockAccountDetail(option)
      contextForAccountDetail.ask.mockResolvedValue({
        choice: AppMenu.DEPOSIT,
      })
      ret = await contextForAccountDetail.run(ret.context)
      contextForAtomicSwap = ret.context
      mockedAtomicSwap = mockAtomicSwap(option)
    })

    it('select to swap', async () => {
      mockedAtomicSwap.ask.mockResolvedValue({
        choice: { menu: AppMenu.ATOMIC_SWAP_GIVE_ETH },
      })
      const ret = await mockedAtomicSwap.run(contextForAtomicSwap)
      expect(ret.next).toEqual(AppMenu.ATOMIC_SWAP_GIVE_ETH)
      expect(ret.context.address).toBeUndefined()
    })

    it('select to swap with a spendable utxo', async () => {
      mockedAtomicSwap.ask.mockResolvedValue({
        choice: { menu: AppMenu.ATOMIC_SWAP_GIVE_ETH },
      })
      const accounts: ZkAccount[] = await option.base.retrieveAccounts()
      option.base.getSpendables = jest.fn()
      option.base.getSpendables.mockResolvedValue([
        getFakeUtxo(accounts[0].zkAddress, UtxoStatus.UNSPENT),
      ])
      option.base.getUtxos = jest.fn()
      option.base.getUtxos.mockResolvedValue([
        getFakeUtxo(accounts[0].zkAddress, UtxoStatus.SPENDING),
      ])

      // should be the same no matter there are spendable utxos or not
      const ret = await mockedAtomicSwap.run(contextForAtomicSwap)
      expect(ret.next).toEqual(AppMenu.ATOMIC_SWAP_GIVE_ETH)
      expect(ret.context.address).toBeUndefined()
    })

    it('select to go back', async () => {
      mockedAtomicSwap.ask.mockResolvedValue({
        choice: { menu: AppMenu.ACCOUNT_DETAIL },
      })
      const ret = await mockedAtomicSwap.run(contextForAtomicSwap)
      expect(ret.next).toEqual(AppMenu.ACCOUNT_DETAIL)
      expect(ret.context.address).toBeUndefined()
    })
  })

  describe('atomic swap to give Eth', () => {
    let contextForAtomicSwap: Context
    let mockedAtomicSwap

    beforeAll(async () => {
      let mockedTopMenu = mockTopMenu(option)
      mockedTopMenu.ask.mockResolvedValue({ idx: 0 })
      let ret = await mockedTopMenu.run(context)
      let contextForAccountDetail = mockAccountDetail(option)
      contextForAccountDetail.ask.mockResolvedValue({
        choice: AppMenu.DEPOSIT,
      })
      ret = await contextForAccountDetail.run(ret.context)
      let mockedAtomicSwapMenu = mockAtomicSwap(option)
      mockedAtomicSwapMenu.ask.mockResolvedValue({
        choice: { menu: AppMenu.ATOMIC_SWAP_GIVE_ETH },
      })
      ret = await mockedAtomicSwapMenu.run(ret.context)
      contextForAtomicSwap = ret.context
      mockedAtomicSwap = mockAtomicSwapGiveEth(option)

      const accounts: ZkAccount[] = await option.base.retrieveAccounts()
      option.base.getSpendables = jest.fn()
      option.base.getSpendables.mockResolvedValue([
        getFakeUtxo(accounts[0].zkAddress, UtxoStatus.UNSPENT),
      ])
    })
    beforeEach(async () => {
      if (fs.existsSync('zkwallet-db')) {
        fs.unlinkSync('zkwallet-db')
      }
    })

    it('select to swap with a spendable utxo', async () => {
      option.base.fetchPrice = jest.fn()
      option.base.fetchPrice.mockResolvedValue(100)
      const accounts: ZkAccount[] = await option.base.retrieveAccounts()
      mockedAtomicSwap.ask.mockResolvedValue({
        zkAddress: accounts[1].zkAddress.toString(),
        amount: '0.01', // eth
        fee: '1', // gwei
        salt: '1234',
      })

      const ret = await mockedAtomicSwap.run(contextForAtomicSwap)
      expect(ret.next).toEqual(AppMenu.ATOMIC_SWAP_TAKE)
      const txBuilder = ret.context.swapTxBuilder
      expect(txBuilder.sendings.length).toEqual(1)
      expect(txBuilder.sendings[0].owner.address).toEqual(
        accounts[1].zkAddress.toString(),
      )

      // recovery
      option.base.fetchPrice.mockRestore()
    })

    it('select to swap with a spendable utxo and amount with with leading and trailing space', async () => {
      option.base.fetchPrice = jest.fn()
      option.base.fetchPrice.mockResolvedValue(100)
      const accounts: ZkAccount[] = await option.base.retrieveAccounts()
      mockedAtomicSwap.ask.mockResolvedValue({
        zkAddress: accounts[1].zkAddress.toString(),
        amount: ' 0.01 ', // eth
        fee: ' 1 ', // gwei
        salt: '1234',
      })

      const ret = await mockedAtomicSwap.run(contextForAtomicSwap)
      expect(ret.next).toEqual(AppMenu.ATOMIC_SWAP_TAKE)
      const txBuilder = ret.context.swapTxBuilder
      expect(txBuilder.sendings.length).toEqual(1)
      expect(txBuilder.sendings[0].owner.address).toEqual(
        accounts[1].zkAddress.toString(),
      )

      // recovery
      option.base.fetchPrice.mockRestore()
    })

    it('failed to call fetchPrice', async () => {
      // Not to mock `fetchPrice` here
      await expect(mockedAtomicSwap.run(contextForAtomicSwap)).rejects.toThrow()
    })
  })

  describe('atomic swap menu for taking', () => {
    let contextForAtomicSwap: Context
    let mockedAtomicSwap

    beforeAll(async () => {
      let mockedTopMenu = mockTopMenu(option)
      mockedTopMenu.ask.mockResolvedValue({ idx: 0 })
      let ret = await mockedTopMenu.run(context)
      let contextForAccountDetail = mockAccountDetail(option)
      contextForAccountDetail.ask.mockResolvedValue({
        choice: AppMenu.DEPOSIT,
      })
      ret = await contextForAccountDetail.run(ret.context)
      contextForAtomicSwap = ret.context
      mockedAtomicSwap = mockAtomicSwapTake(option)
    })

    it('select to take Eth', async () => {
      mockedAtomicSwap.ask.mockResolvedValue({
        choice: { menu: AppMenu.ATOMIC_SWAP_TAKE_ETH },
      })
      const ret = await mockedAtomicSwap.run(contextForAtomicSwap)
      expect(ret.next).toEqual(AppMenu.ATOMIC_SWAP_TAKE_ETH)
      expect(ret.address).toBeUndefined()
    })

    it('select to go back', async () => {
      mockedAtomicSwap.ask.mockResolvedValue({
        choice: { menu: AppMenu.ACCOUNT_DETAIL },
      })

      // should be the same no matter there are spendable utxos or not
      const ret = await mockedAtomicSwap.run(contextForAtomicSwap)
      expect(ret.next).toEqual(AppMenu.ACCOUNT_DETAIL)
      expect(ret.address).toBeUndefined()
    })
  })

  describe('atomic swap to take Eth', () => {
    let contextForAtomicSwap: Context
    let mockedAtomicSwap

    beforeAll(async () => {
      const mockedTopMenu = mockTopMenu(option)
      mockedTopMenu.ask.mockResolvedValue({ idx: 0 })
      let ret = await mockedTopMenu.run(context)
      let contextForAccountDetail = mockAccountDetail(option)
      contextForAccountDetail.ask.mockResolvedValue({
        choice: AppMenu.DEPOSIT,
      })
      ret = await contextForAccountDetail.run(ret.context)

      contextForAtomicSwap = ret.context
      mockedAtomicSwap = mockAtomicSwapTakeEth(option)
    })

    beforeEach(async () => {
      const accounts: ZkAccount[] = await option.base.retrieveAccounts()
      contextForAtomicSwap.swapTxBuilder = getFakeSwapTxBuilder(
        accounts[0].zkAddress,
      )
    })

    it('take Eth less than giver gave', async () => {
      mockedAtomicSwap.ask.mockResolvedValue({
        amount: '0.01', // Eth
        salt: '1234',
      })
      const spySendTx = jest
        .spyOn(option.base, 'sendTx')
        .mockImplementation((() => {}) as any)

      const ret = await mockedAtomicSwap.run(contextForAtomicSwap)
      expect(ret.next).toEqual(AppMenu.ACCOUNT_DETAIL)
      expect(spySendTx).toHaveBeenCalled()
    })

    it('take Eth equal to giver gave', async () => {
      mockedAtomicSwap.ask.mockResolvedValue({
        amount: '1', // Eth
        salt: '1234',
      })
      const spySendTx = jest
        .spyOn(option.base, 'sendTx')
        .mockImplementation((() => {}) as any)

      const ret = await mockedAtomicSwap.run(contextForAtomicSwap)
      expect(ret.next).toEqual(AppMenu.ACCOUNT_DETAIL)
      expect(spySendTx).toHaveBeenCalled()
    })

    it('take Eth more than giver gave', async () => {
      // cli should still be working even a user claims more than he/she has
      mockedAtomicSwap.ask.mockResolvedValue({
        amount: '1.01', // Eth
        salt: '1234',
      })
      const spySendTx = jest
        .spyOn(option.base, 'sendTx')
        .mockImplementation((() => {}) as any)

      const ret = await mockedAtomicSwap.run(contextForAtomicSwap)
      expect(ret.next).toEqual(AppMenu.ACCOUNT_DETAIL)
      expect(spySendTx).toHaveBeenCalled()
    })

    it('take Eth less than giver gave and amount with leading and trailing space', async () => {
      mockedAtomicSwap.ask.mockResolvedValue({
        amount: ' 0.01 ', // Eth
        salt: '1234',
      })
      const spySendTx = jest
        .spyOn(option.base, 'sendTx')
        .mockImplementation((() => {}) as any)

      const ret = await mockedAtomicSwap.run(contextForAtomicSwap)
      expect(ret.next).toEqual(AppMenu.ACCOUNT_DETAIL)
      expect(spySendTx).toHaveBeenCalled()
    })
  })

  describe('withdraw request', () => {
    let contextForWithdraw
    let mockedWithdraw

    beforeAll(async () => {
      let mockedTopMenu = mockTopMenu(option)
      mockedTopMenu.ask.mockResolvedValue({ idx: 0 })
      let ret = await mockedTopMenu.run(context)
      contextForWithdraw = ret.context

      mockedWithdraw = mockWithdrawRequest(option)
    })

    it('select each menu', async () => {
      const choices = [
        AppMenu.ACCOUNT_DETAIL,
        AppMenu.WITHDRAW_REQUEST_ETH,
        -1, // unsupported value
      ]
      for (let choice of choices) {
        mockedWithdraw.ask.mockResolvedValue({ choice: { menu: choice } })
        const ret = await mockedWithdraw.run(contextForWithdraw)
        expect(ret.context.address).toBeUndefined()
        expect(ret.next).toEqual(choice)
      }
    })
  })

  describe('withdraw request Eth', () => {
    let contextForWithdraw
    let mockedWithdraw

    beforeAll(async () => {
      let mockedTopMenu = mockTopMenu(option)
      mockedTopMenu.ask.mockResolvedValue({ idx: 0 })
      let ret = await mockedTopMenu.run(context)
      contextForWithdraw = ret.context
      mockedWithdraw = mockWithdrawRequestEth(option)

      const accounts: ZkAccount[] = await option.base.retrieveAccounts()
      option.base.getSpendables = jest.fn()
      option.base.getSpendables.mockResolvedValue([
        getFakeUtxo(accounts[0].zkAddress, UtxoStatus.UNSPENT),
      ])
      // mock zkWallet.fetchPrice bcs it queries coordinator
      option.base.fetchPrice = jest.fn()
      option.base.fetchPrice.mockResolvedValue(100)
    })

    beforeEach(async () => {
      jest.restoreAllMocks()
    })

    it('withdraw to self', async () => {
      mockedWithdraw.ask.mockResolvedValue({
        address: contextForWithdraw.account?.ethAddress,
        amount: '0.1', // eth
        fee: '1', // gwei
        prePayFee: '0', // gwei
      })
      const spySendTx = jest
        .spyOn(option.base, 'sendTx')
        .mockImplementation((() => {}) as any)

      const ret = await mockedWithdraw.run(contextForWithdraw)
      expect(ret.next).toEqual(AppMenu.TRANSFER)
      expect(spySendTx).toHaveBeenCalled()
    })

    it('withdraw to accounts[1]', async () => {
      const accounts: ZkAccount[] = await option.base.retrieveAccounts()
      mockedWithdraw.ask.mockResolvedValue({
        address: accounts[1].ethAddress,
        amount: '0.1', // eth
        fee: '1', // gwei
        prePayFee: '0', // gwei
      })
      const spySendTx = jest
        .spyOn(option.base, 'sendTx')
        .mockImplementation((() => {}) as any)

      const ret = await mockedWithdraw.run(contextForWithdraw)
      expect(ret.next).toEqual(AppMenu.TRANSFER)
      expect(spySendTx).toHaveBeenCalled()
    })

    it('withdraw to self and amount with leading and trailing space', async () => {
      mockedWithdraw.ask.mockResolvedValue({
        address: contextForWithdraw.account?.ethAddress,
        amount: ' 0.1 ', // eth
        fee: ' 1 ', // gwei
        prePayFee: ' 0 ', // gwei
      })
      const spySendTx = jest
        .spyOn(option.base, 'sendTx')
        .mockImplementation((() => {}) as any)

      const ret = await mockedWithdraw.run(contextForWithdraw)
      expect(ret.next).toEqual(AppMenu.TRANSFER)
      expect(spySendTx).toHaveBeenCalled()
    })
  })

  describe('withdraw list', () => {
    let contextForWithdraw: Context
    let mockedWithdraw

    beforeAll(async () => {
      let mockedTopMenu = mockTopMenu(option)
      mockedTopMenu.ask.mockResolvedValue({ idx: 0 })
      let ret = await mockedTopMenu.run(context)
      contextForWithdraw = ret.context

      mockedWithdraw = mockWithdrawableList(option)
    })

    it('select to withdraw', async () => {
      const choices = [AppMenu.INSTANT_WITHDRAW, AppMenu.WITHDRAW]
      const accounts: ZkAccount[] = await option.base.retrieveAccounts()
      const w = {
        hash: '',
        withdrawalHash: '',
        eth: parseEther('0.01'),
        tokenAddr: '0x0',
        erc20Amount: '0',
        nft: '0',
        to: accounts[0].ethAddress,
        fee: '1',
      }
      for (let choice of choices) {
        mockedWithdraw.ask.mockResolvedValue({
          choice: { menu: choice, withdrawal: w },
        })
        const ret = await mockedWithdraw.run(contextForWithdraw)
        expect(ret.next).toEqual(choice)
        expect(ret.context.withdrawal).toEqual(w)
      }
    })

    it('select to go back', async () => {
      const choices = [
        AppMenu.ACCOUNT_DETAIL,
        -1, // unsupported value
      ]
      for (let choice of choices) {
        mockedWithdraw.ask.mockResolvedValue({
          choice: { menu: choice },
        })
        const ret = await mockedWithdraw.run(contextForWithdraw)
        expect(ret.next).toEqual(choice)
        expect(ret.context.withdrawal).toBeUndefined()
      }
    })
  })

  describe('withdraw', () => {
    let contextForWithdraw: Context
    let withdraw

    beforeAll(async () => {
      let mockedTopMenu = mockTopMenu(option)
      mockedTopMenu.ask.mockResolvedValue({ idx: 0 })
      let ret = await mockedTopMenu.run(context)
      contextForWithdraw = ret.context
      withdraw = new Withdraw(option)
    })

    beforeEach(async () => {
      jest.restoreAllMocks()
    })

    it('withdraw', async () => {
      const mockedWithdrawList = mockWithdrawableList(option)
      const accounts: ZkAccount[] = await option.base.retrieveAccounts()
      const w = {
        hash: '0x123',
        withdrawalHash: '0xabc',
        eth: parseEther('0.01'),
        tokenAddr: '0x0',
        erc20Amount: '0',
        nft: '0',
        to: accounts[0].ethAddress,
        fee: '1',
      }
      mockedWithdrawList.ask.mockResolvedValue({
        choice: { menu: AppMenu.WITHDRAW, withdrawal: w },
      })
      let ret = await mockedWithdrawList.run(contextForWithdraw)

      const spyWithdraw = jest
        .spyOn(option.base, 'withdraw')
        .mockImplementation((() => {}) as any)
      ret = await withdraw.run(ret.context)
      expect(ret.next).toEqual(AppMenu.WITHDRAWABLE_LIST)
      expect(ret.context.withdrawal).toBeUndefined()
      expect(spyWithdraw).toBeCalledWith(w)
    })

    it('withdraw but not correct context', async () => {
      await expect(withdraw.run(contextForWithdraw)).rejects.toThrowError(
        'Withdrawal is not set',
      )
    })
  })
})
