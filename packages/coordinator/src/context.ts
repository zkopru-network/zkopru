import { FullNode } from '@zkopru/core'
import { BigNumber, Signer } from 'ethers'
import { TxPoolInterface } from './tx-pool'
import { AuctionMonitor } from './auction-monitor'

export interface CoordinatorConfig {
  maxBytes: number
  bootstrap: boolean
  port: number
  priceMultiplier: number // gas per byte is 16, our default value is 32
  maxBid: number
  maxPriorityFeePerGas?: number
  publicUrls?: string
  vhosts: string
  corsdomain?: string
}

export interface CoordinatorContext {
  auctionMonitor: AuctionMonitor

  node: FullNode

  account: Signer

  effectiveGasPrice?: BigNumber

  txPool: TxPoolInterface

  config: CoordinatorConfig
}
