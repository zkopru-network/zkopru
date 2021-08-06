import Web3 from 'web3'
import { OrganizerQueueConfig } from './organizer-queue'

// Generator types

// Organizer API types
interface WalletData {
  registeredId: number
  from?: string
}

interface GasData {
  from: string
  inputSize: number
  gasUsed?: number
}

interface CoordinatorUrls {
  [account: string]: string
}

export interface OrganizerConfig extends OrganizerQueueConfig {
  dev?: boolean
  organizerPort?: number
}

export interface OrganizerContext {
  web3: Web3
  coordinators: CoordinatorUrls
}

export interface RegisterData {
  ID: number
  from: string
  role: 'wallet' | 'coordinator'
  url: string
}

export interface TxData {
  [txHash: string]: {
    from: string
    gas: number
    gasUsed?: number
    success?: boolean
  }
}

export interface ProposeData {
  timestamp: number
  proposeNum: number
  parentsBlockHash: string
  blockHash: string
  txcount: number
  from?: string
  layer1TxHash?: string
  layer1BlockNumber?: number
  finalized?: boolean // TODO: add feature to update from finzlizer
}

export interface OrganizerData {
  layer1: {
    txData: TxData[]
    gasTable: { [sig: string]: GasData[] }
  }
  coordinatorData: ProposeData[]
  walletData: WalletData[]
}
