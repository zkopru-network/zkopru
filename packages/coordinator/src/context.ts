import { FullNode } from '@zkopru/core'
import BN from 'bn.js'
import { Account } from 'web3-core'
import { TxPoolInterface } from './tx-pool'
import { AuctionMonitor } from './auction-monitor'

export interface CoordinatorConfig {
  maxBytes: number
  bootstrap: boolean
  port: number
  priceMultiplier: number // gas per byte is 16, our default value is 32
  maxBid: number
  publicUrls?: string
  vhosts: string
}

export interface CoordinatorContext {
  auctionMonitor: AuctionMonitor

  node: FullNode

  account: Account

  gasPrice?: BN

  txPool: TxPoolInterface

  config: CoordinatorConfig
}
