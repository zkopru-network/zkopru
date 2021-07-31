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
  organizerPort?: number
}

export interface OrganizerContext {
  web3: Web3
  coordinators: CoordinatorUrls
}

export interface TxSummary {
  [txHash: string]: {
    from: string
    funcSig: string
    inputSize: number
    gas: number
    gasUsed?: number
    success?: boolean
  }
}

export interface ProposeData {
  timestamp: number
  proposeNum: number
  blockHash: string
  parentsBlockHash: string
  txcount: number
  from?: string
  layer1TxHash?: string
  layer1BlockNumber?: number
  finalized?: boolean // TODO: add feature to update from finzlizer
}

export interface OrganizerData {
  layer1: {
    txSummaries: TxSummary[]
    gasTable: { [sig: string]: GasData[] }
  }
  coordinatorData: ProposeData[]
  walletData: WalletData[]
}
