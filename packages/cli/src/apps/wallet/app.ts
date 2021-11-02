import { ZkopruNode } from '@zkopru/core'
import { ZkWallet } from '@zkopru/zk-wizard'
import { Dashboard } from '../../dashboard'
import { AppMenu, Context } from './prompts'
import TopMenu from './prompts/menus/top-menus'
import OnSyncing from './prompts/menus/on-syncing'
import AccountDetail from './prompts/menus/account-detail'
import Deposit from './prompts/menus/account-detail-deposit'
import DepositEther from './prompts/menus/account-detail-deposit-eth'
import TransferEth from './prompts/menus/account-detail-transfer-eth'
import TransferMenu from './prompts/menus/account-detail-transfer-menu'
import WithdrawRequest from './prompts/menus/account-detail-withdraw-request-menu'
import WithdrawRequestEth from './prompts/menus/account-detail-withdraw-request-eth'
import WithdrawableList from './prompts/menus/account-detail-withdrawable-list'
import Withdraw from './prompts/menus/account-detail-withdraw'
import AtomicSwap from './prompts/menus/account-detail-swap'
import AtomicSwapGiveEth from './prompts/menus/account-detail-swap-give-eth'
import AtomicSwapTake from './prompts/menus/account-detail-swap-take'
import AtomicSwapTakeEth from './prompts/menus/account-detail-swap-take-eth'

export class WalletDashboard extends Dashboard<Context, ZkWallet> {
  node: ZkopruNode

  constructor(zkWallet: ZkWallet, onCancel: () => Promise<void>) {
    super({ isReady: true }, zkWallet)
    const option = {
      base: zkWallet,
      onCancel,
    }
    const { node } = zkWallet
    this.node = node
    this.node.start()
    this.addPromptApp(AppMenu.TOP_MENU, new TopMenu(option))
    this.addPromptApp(AppMenu.ON_SYNCING, new OnSyncing(option))
    this.addPromptApp(AppMenu.ACCOUNT_DETAIL, new AccountDetail(option))
    this.addPromptApp(AppMenu.DEPOSIT, new Deposit(option))
    this.addPromptApp(AppMenu.DEPOSIT_ETHER, new DepositEther(option))
    this.addPromptApp(AppMenu.TRANSFER, new TransferMenu(option))
    this.addPromptApp(AppMenu.TRANSFER_ETH, new TransferEth(option))
    this.addPromptApp(AppMenu.ATOMIC_SWAP, new AtomicSwap(option))
    this.addPromptApp(
      AppMenu.ATOMIC_SWAP_GIVE_ETH,
      new AtomicSwapGiveEth(option),
    )
    this.addPromptApp(AppMenu.ATOMIC_SWAP_TAKE, new AtomicSwapTake(option))
    this.addPromptApp(
      AppMenu.ATOMIC_SWAP_TAKE_ETH,
      new AtomicSwapTakeEth(option),
    )
    this.addPromptApp(AppMenu.WITHDRAW_REQUEST, new WithdrawRequest(option))
    this.addPromptApp(
      AppMenu.WITHDRAW_REQUEST_ETH,
      new WithdrawRequestEth(option),
    )
    this.addPromptApp(AppMenu.WITHDRAWABLE_LIST, new WithdrawableList(option))
    this.addPromptApp(AppMenu.WITHDRAW, new Withdraw(option))
  }
}
