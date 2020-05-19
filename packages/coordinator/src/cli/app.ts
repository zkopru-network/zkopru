import Web3 from 'web3'
import { InanoSQLInstance } from '@nano-sql/core/lib/interfaces'
import { NetworkStatus } from '@zkopru/core'
import { WebsocketProvider, EncryptedKeystoreV3Json } from 'web3-core'
import { PromptApp } from '@zkopru/utils'
import { Coordinator } from '..'

export interface Config {
  address: string
  bootstrap: boolean
  websocket: string
  db: string
  maxBytes: number
  priceMultiplier: number
  port: number
  config?: string
  keystore?: EncryptedKeystoreV3Json
  password?: string
}

export enum Menu {
  SPLASH,
  CONNECT_WEB3,
  CONFIG_ACCOUNT,
  SAVE_CONFIG,
  LOAD_DATABASE,
  LOAD_COORDINATOR,
  COMPLETE_SETUP,
}

export interface Context {
  menu: Menu
  networkStatus: NetworkStatus
  zkopruId?: string
  web3?: Web3
  provider?: WebsocketProvider
  db?: InanoSQLInstance
  coordinator?: Coordinator
  keystore?: EncryptedKeystoreV3Json
  password?: string
}

export default abstract class App extends PromptApp<Context, Config> {}
