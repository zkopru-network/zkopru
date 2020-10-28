import { FullNode } from '@zkopru/core'
import BN from 'bn.js'
import { Account } from 'web3-core'
import { TxPoolInterface } from './tx-pool'

export interface CoordinatorConfig {
  maxBytes: number
  bootstrap: boolean
  port: number
  priceMultiplier: number // gas per byte is 16, our default value is 32
}

export interface CoordinatorContext {
  node: FullNode

  account: Account

  gasPrice?: BN

  txPool: TxPoolInterface

  config: CoordinatorConfig
}
