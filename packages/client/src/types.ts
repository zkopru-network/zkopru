import { ZkAccount } from '@zkopru/account'

export enum RpcType {
  http = 0,
}

export interface RpcConfig {
  type: RpcType
  url: string
}

export interface Block {
  hash: string
  proposalNum: number
  canonicalNum: number
  proposedAt: number
  proposalTx: string
  fetched: string
  finalized: boolean
  verified: boolean
  isUncle: boolean
  header: {
    hash: string
    proposer: string
    parentBlock: string
    fee: string
    utxoRoot: string
    utxoIndex: string
    nullifierRoot: string
    withdrawalRoot: string
    withdrawalIndex: string
    txRoot: string
    depositRoot: string
    migrationRoot: string
  }
  body: {
    txs: {
      inflow: string
      outflow: string
      fee: string
    }[]
    massDeposits: {
      merged: string
      fee: string
    }[]
    massMigrations: any[]
  }
}

export interface Tx {
  hash: string
}

export interface Registry {
  erc20s: string[]
  erc721s: string[]
}

export type NodeConfig = {
  address?: string
  bootstrap?: boolean
  websocket?: string
  chainId?: number
  rpcUrl?: string
  accounts?: ZkAccount[]
}
