import Web3 from 'web3'
import { InanoSQLInstance } from '@nano-sql/core/lib/interfaces'
import { ZkOPRUNode, NetworkStatus } from '@zkopru/core'
import { ZkAccount, HDWallet } from '@zkopru/account'
import { ZkWizard } from '@zkopru/zk-wizard'
import { WebsocketProvider } from 'web3-core'
import { PromptApp } from '@zkopru/utils'

export interface Config {
  fullnode: boolean
  develop: boolean
  address: string
  bootstrap: string
  websocket: string
  keys: string
  db: string
  mnemonic?: string
}

export enum Menu {
  SPLASH,
  CONNECT_WEB3,
  DOWNLOAD_KEYS,
  LOAD_DATABASE,
  LOAD_HDWALLET,
  CONFIG_TRACKING_ACCOUNT,
  SELECT_ACCOUNT,
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
  wizard?: ZkWizard
  accounts?: ZkAccount[]
}

export default abstract class App extends PromptApp<Context, Config> {}
