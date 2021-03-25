import Web3 from 'web3'
import { ZkopruNode, NetworkStatus } from '@zkopru/core'
import { ZkAccount, HDWallet } from '@zkopru/account'
import { DB, EncryptedWallet } from '@zkopru/database'
import { PromptApp } from '@zkopru/utils'
import { WebsocketProvider } from 'web3-core'

export interface Config {
  fullnode: boolean
  develop: boolean
  address: string
  coordinator: string
  websocket: string
  keys: string
  sqlite?: string
  postgres?: string
  config?: string
  mnemonic?: string
  erc20?: string[]
  erc721?: string[]
  seedKeystore?: EncryptedWallet
  password?: string
  numberOfAccounts?: number
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
  COMPLETE,
  EXIT,
}

export interface Context {
  menu: Menu
  networkStatus: NetworkStatus
  web3?: Web3
  provider?: WebsocketProvider
  db?: DB
  wallet?: HDWallet
  node?: ZkopruNode
  accounts?: ZkAccount[]
  passwordHash?: string
  isInitialSetup?: boolean
}

export default abstract class Configurator extends PromptApp<Context, Config> {}
