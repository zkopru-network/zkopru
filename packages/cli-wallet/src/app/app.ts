import { PromptApp } from '@zkopru/utils'
import { ZkAccount } from '@zkopru/account'
import { Sum } from '@zkopru/transaction'
import { ZkWallet, Balance } from '../zk-wallet'

export enum AppMenu {
  TOP_MENU,
  ON_SYNCING,
  ACCOUNT_DETAIL,
  DEPOSIT,
  DEPOSIT_ETHER,
  DEPOSIT_ERC20,
  DEPOSIT_ERC721,
  TRANSFER,
  WITHDRAW,
  EXIT,
}

export interface Context {
  menu: AppMenu
  account?: ZkAccount
  address?: string
  isReady: boolean
  balance?: Balance
  spendables?: Sum
}

export default abstract class App extends PromptApp<Context, ZkWallet> {
  zkWallet: ZkWallet

  constructor(zkWallet: ZkWallet, onCancel: () => Promise<void>) {
    super(zkWallet, onCancel)
    this.zkWallet = zkWallet
  }
}
