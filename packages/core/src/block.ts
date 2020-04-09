import { ZkTx } from '@zkopru/transaction'
import { BlockSql, BlockStatus } from '@zkopru/database'
import { Transaction } from 'web3-core'

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

export class Block {
  hash: string

  status: number

  proposedAt: number

  parent: string

  submissionId: string

  header: Header

  body: Body

  constructor({
    hash,
    submissionId,
    status,
    proposedAt,
    parent,
    header,
    body,
  }: {
    hash: string
    status: number
    proposedAt: number
    parent: string
    submissionId: string
    header: Header
    body: Body
  }) {
    this.hash = hash
    this.submissionId = submissionId
    this.status = status
    this.proposedAt = proposedAt
    this.parent = parent
    this.header = header
    this.body = body
  }

  toSqlObj(): BlockSql {
    return {
      hash: this.hash,
      status: BlockStatus.FETCHED,
      proposedAt: this.proposedAt,
      submissionId: this.submissionId,
      header: this.header,
    }
  }

  toBytes(): Buffer {
    return Buffer.from(this.hash)
  }

  static fromLayer1Tx(tx: Transaction): Block {
    console.log(tx)
    const test: any = {}
    return new Block({
      ...test,
    })
  }
}
