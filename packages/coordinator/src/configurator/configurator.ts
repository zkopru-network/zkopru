import Web3 from 'web3'
import { NetworkStatus } from '@zkopru/core'
import { Account, WebsocketProvider, EncryptedKeystoreV3Json } from 'web3-core'
import { DB } from '@zkopru/prisma'
import { PromptApp } from '../prompt'
import { Coordinator } from '..'

export interface Config {
  address: string
  bootstrap: boolean
  websocket: string
  sqlite?: string
  postgres?: string
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
  networkStatus: NetworkStatus
  web3?: Web3
  provider?: WebsocketProvider
  db?: DB
  coordinator?: Coordinator
  keystore?: EncryptedKeystoreV3Json
  account?: Account
}

export default abstract class Configurator extends PromptApp<Context, Config> {}
