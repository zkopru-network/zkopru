import { Coordinator } from '@zkopru/coordinator'
import { NetworkStatus } from '@zkopru/core'
import { DB } from '@zkopru/database'
import { PromptApp } from '@zkopru/utils'
import { BaseProvider } from '@ethersproject/providers'
import { EncryptedKeystoreV3Json } from 'web3-core'
import { Signer } from 'ethers'

export interface Config {
  address: string
  bootstrap: boolean
  provider: string
  sqlite?: string
  postgres?: string
  maxBytes: number
  priceMultiplier: number
  port: number
  config?: string
  keystore?: EncryptedKeystoreV3Json
  keystoreFile?: string
  password?: string
  passwordFile?: string
  daemon?: boolean
  maxBid: number
  maxPriorityFeePerGas?: number
  publicUrls?: string
  vhosts: string
  corsdomain?: string
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
  provider?: BaseProvider
  db?: DB
  coordinator?: Coordinator
  keystore?: EncryptedKeystoreV3Json
  account?: Signer
}

export default abstract class Configurator extends PromptApp<Context, Config> {}
