import { ZkTx } from '@zkopru/transaction'
import { BlockSql, BlockStatus } from '@zkopru/database'
import { Transaction } from 'web3-core'
// import { soliditySha3 } from 'web3-utils'

export interface MassDeposit {
  merged: string
  fee: string
}

export interface ERC20Migration {
  addr: string
  amount: string
}

export interface ERC721Migration {
  addr: string
  nfts: string[]
}

export interface MassMigration {
  destination: string
  totalETH: string
  migratingLeaves: MassDeposit
  erc20: ERC20Migration[]
  erc721: ERC721Migration[]
}

export interface Header {
  proposer: string
  parentBlock: string
  metadata: string
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

export interface Body {
  txs: ZkTx[]
  massDeposits: MassDeposit[]
  massMigration: MassMigration[]
}

export interface Finalization {
  submissionId: string
  header: Header
  massDeposits: MassDeposit[]
  massMigration: MassMigration[]
}

export interface Block {
  hash: string

  status: BlockStatus

  proposedAt: number

  parent: string

  txHash: string

  txData?: Transaction

  header: Header

  body: Body
}

export function blockToSqlObj(block: Block): BlockSql {
  return {
    hash: block.hash,
    status: block.status,
    proposedAt: block.proposedAt,
    txHash: block.txHash,
    header: block.header,
    txData: block.txData ? block.txData : undefined,
  }
}

export function blockToBytes(block: Block): Buffer {
  // TODO
  return Buffer.from(block.hash)
}

export function blockFromLayer1Tx(tx: Transaction): Block {
  // TODO
  console.log(tx)
  const test: any = {}
  return {
    ...test,
  } as Block
}

export function headerHash(header: Header): string {
  // TODO
  return header.depositRoot
}
