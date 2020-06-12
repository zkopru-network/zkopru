import { ZkAccount } from '@zkopru/account'
import { Sum } from '@zkopru/transaction'
import { PromptApp } from '@zkopru/utils'
import { ZkWallet, Balance } from '@zkopru/zk-wizard'
import { Dashboard } from '../../../dashboard'

export enum AppMenu {
  ON_SYNCING,
  ACCOUNT_DETAIL,
  DEPOSIT,
  DEPOSIT_ETHER,
  DEPOSIT_ERC20,
  DEPOSIT_ERC721,
  TRANSFER,
  TRANSFER_ETH,
  WITHDRAW,
  TOP_MENU = Dashboard.START_CODE,
  EXIT = Dashboard.EXIT_CODE,
}

export interface Context {
  account?: ZkAccount
  address?: string
  isReady: boolean
  balance?: Balance
  spendables?: Sum
}

export default abstract class App extends PromptApp<Context, ZkWallet> {}
