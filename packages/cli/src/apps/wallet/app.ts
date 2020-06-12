import { ZkOPRUNode } from '@zkopru/core'
import { ZkWallet } from '@zkopru/zk-wizard'
import { Dashboard } from '../../dashboard'
import { AppMenu, Context } from './prompts'
import TopMenu from './prompts/menus/top-menus'
import OnSyncing from './prompts/menus/on-syncing'
import AccountDetail from './prompts/menus/account-detail'
import Deposit from './prompts/menus/account-detail-deposit'
import DepositEther from './prompts/menus/account-detail-deposit-eth'
import TransferMenu from './prompts/menus/account-detail-my-utxos'
import TransferEth from './prompts/menus/account-detail-transfer-eth'

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
    this.addPromptApp(AppMenu.TRANSFER, new TransferMenu(option))
    this.addPromptApp(AppMenu.TRANSFER_ETH, new TransferEth(option))
  }
}
