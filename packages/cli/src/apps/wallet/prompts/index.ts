import { ZkAccount } from '@zkopru/account'
import { Sum, SwapTxBuilder } from '@zkopru/transaction'
import { PromptApp } from '@zkopru/utils'
import { ZkWallet, Balance } from '@zkopru/zk-wizard'
import { Withdrawal as WithdrawalSql } from '@zkopru/database'
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
  TRANSFER_ERC20,
  TRANSFER_ERC721,
  ATOMIC_SWAP,
  ATOMIC_SWAP_GIVE_ETH,
  ATOMIC_SWAP_TAKE,
  ATOMIC_SWAP_TAKE_ETH,
  WITHDRAW_REQUEST,
  WITHDRAW_REQUEST_ETH,
  WITHDRAW_REQUEST_ERC20,
  WITHDRAW_REQUEST_ERC721,
  WITHDRAW,
  INSTANT_WITHDRAW,
  WITHDRAWABLE_LIST,
  TOP_MENU = Dashboard.START_CODE,
  EXIT = Dashboard.EXIT_CODE,
}

export interface Context {
  account?: ZkAccount
  address?: string
  isReady: boolean
  balance?: Balance
  spendables?: Sum
  withdrawal?: WithdrawalSql
  swapTxBuilder?: SwapTxBuilder
}

export default abstract class App extends PromptApp<Context, ZkWallet> {}
