import Web3 from 'web3'
import { InanoSQLInstance } from '@nano-sql/core/lib/interfaces'
import { ZkOPRUNode, NetworkStatus } from '@zkopru/core'
import { ZkAccount, HDWallet } from '@zkopru/account'
import { WebsocketProvider } from 'web3-core'
import { PromptApp } from '@zkopru/utils'
import { HDWalletSql } from '@zkopru/database'
import { ZkWallet } from '../zk-wallet'

export interface Config {
  fullnode: boolean
  develop: boolean
  address: string
  coordinator: string
  websocket: string
  keys: string
  db: string
  config?: string
  mnemonic?: string
  erc20?: string[]
  erc721?: string[]
  seedKeystore?: HDWalletSql
  password?: string
  accountNumber?: number
}

export enum Menu {
  SPLASH,
  CONNECT_WEB3,
  DOWNLOAD_KEYS,
  LOAD_DATABASE,
  LOAD_HDWALLET,
  CONFIG_TRACKING_ACCOUNT,
  SAVE_CONFIG,
  SHOW_UTXOS,
  LOAD_NODE,
  NODE_SYNC,
  ACCOUNT_DETAIL,
  SHOW_TOP_MENU,
  EXIT,
}

export interface Context {
  menu: Menu
  networkStatus: NetworkStatus
  zkopruId?: string
  web3?: Web3
  provider?: WebsocketProvider
  db?: InanoSQLInstance
  wallet?: HDWallet
  account?: ZkAccount
  node?: ZkOPRUNode
  accounts?: ZkAccount[]
  zkWallet?: ZkWallet
  passwordHash?: string
  isInitialSetup?: boolean
}

export default abstract class Configurator extends PromptApp<Context, Config> {}
