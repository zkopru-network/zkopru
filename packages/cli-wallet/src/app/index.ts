import { ZkOPRUNode } from '@zkopru/core'
import { Dashboard } from '../dashboard'
import { ZkWallet } from '../zk-wallet'
import { AppMenu, Context } from './app'
import TopMenu from './menus/top-menus'
import OnSyncing from './menus/on-syncing'
import AccountDetail from './menus/account-detail'
import Deposit from './menus/account-detail-deposit'
import DepositEther from './menus/account-detail-deposit-eth'

export class WalletDashboard extends Dashboard<Context, ZkWallet> {
  node: ZkOPRUNode

  constructor(zkWallet: ZkWallet, onCancel: () => Promise<void>) {
    super({ isReady: true }, zkWallet)
    const option = {
      base: zkWallet,
      onCancel,
    }
    const { node } = zkWallet
    this.node = node
    this.node.startSync()
    this.addPromptApp(AppMenu.TOP_MENU, new TopMenu(option))
    this.addPromptApp(AppMenu.ON_SYNCING, new OnSyncing(option))
    this.addPromptApp(AppMenu.ACCOUNT_DETAIL, new AccountDetail(option))
    this.addPromptApp(AppMenu.DEPOSIT, new Deposit(option))
    this.addPromptApp(AppMenu.DEPOSIT_ETHER, new DepositEther(option))
  }
}
