import { PromptApp } from '@zkopru/utils'
import { ZkAccount } from '@zkopru/account'
import { ZkWallet } from '../zk-wallet'

export enum AppMenu {
  TOP_MENU,
  ACCOUNT_DETAIL,
  DEPOSIT_ETHER,
  EXIT,
}

export interface Context {
  menu: AppMenu
  account?: ZkAccount
}

export default abstract class App extends PromptApp<Context, ZkWallet> {
  zkWallet: ZkWallet

  constructor(zkWallet: ZkWallet, onCancel: () => Promise<void>) {
    super(zkWallet, onCancel)
    this.zkWallet = zkWallet
  }
}
