/* eslint-disable @typescript-eslint/camelcase */
import {
  ZkTx,
  ZkInflow,
  ZkOutflow,
  PublicData,
  SNARK,
} from '@zkopru/transaction'
import { BlockSql, BlockStatus } from '@zkopru/database'
import * as Utils from '@zkopru/utils'
import { Field } from '@zkopru/babyjubjub'
import { Transaction } from 'web3-core'
import { soliditySha3 } from 'web3-utils'
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

export interface Proposal {
  header: Header
  body: Body
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
  massMigrations: MassMigration[]
}

export interface Finalization {
  submissionId: string
  header: Header
  massDeposits: MassDeposit[]
  massMigration: MassMigration[]
}

export enum VerifyResult {
  INVALIDATED,
  PARTIALLY_VERIFIED,
  FULLY_VERIFIED,
}

export function serializeHeader(header: Header): Buffer {
  // Header
  const headerBytes = Buffer.concat([
    Utils.hexToBuffer(header.proposer, 20),
    Utils.hexToBuffer(header.parentBlock, 32),
    Utils.hexToBuffer(header.metadata, 32),
    Utils.hexToBuffer(header.fee, 32),
    Utils.hexToBuffer(header.utxoRoot, 32),
    Utils.hexToBuffer(header.utxoIndex, 32),
    Utils.hexToBuffer(header.nullifierRoot, 32),
    Utils.hexToBuffer(header.withdrawalRoot, 32),
    Utils.hexToBuffer(header.withdrawalIndex, 32),
    Utils.hexToBuffer(header.txRoot, 32),
    Utils.hexToBuffer(header.depositRoot, 32),
    Utils.hexToBuffer(header.migrationRoot, 32),
  ])
  return headerBytes
}

export function serializeBody(body: Body): Buffer {
  const arr: Buffer[] = []
  // Txs
  const txLenBytes = Utils.hexToBuffer(body.txs.length.toString(16), 2)
  arr.push(txLenBytes)
  for (let i = 0; i < body.txs.length; i += 1) {
    const numOfInflowByte = Utils.hexToBuffer(
      body.txs[i].inflow.length.toString(16),
      1,
    )
    arr.push(numOfInflowByte)
    for (let j = 0; j < body.txs[i].inflow.length; j += 1) {
      arr.push(body.txs[i].inflow[j].root.toBuffer('be', 32))
      arr.push(body.txs[i].inflow[j].nullifier.toBuffer('be', 32))
    }
    const numOfOutflowByte = Utils.hexToBuffer(
      body.txs[i].outflow.length.toString(16),
      1,
    )
    arr.push(numOfOutflowByte)
    for (let j = 0; j < body.txs[i].outflow.length; j += 1) {
      arr.push(body.txs[i].outflow[j].note.toBuffer('be', 32))
      arr.push(body.txs[i].outflow[j].outflowType.toBuffer('be', 1))
      const { data } = body.txs[i].outflow[j]
      if (data) {
        arr.push(data.to.toBuffer('be', 20))
        arr.push(data.eth.toBuffer('be', 32))
        arr.push(data.tokenAddr.toBuffer('be', 20))
        arr.push(data.erc20Amount.toBuffer('be', 32))
        arr.push(data.nft.toBuffer('be', 32))
        arr.push(data.fee.toBuffer('be', 32))
      } else if (!body.txs[i].outflow[j].outflowType.isZero()) {
        throw Error('public data should exist')
      }
    }
    arr.push(body.txs[i].fee.toBuffer('be', 32))
    const { proof } = body.txs[i]
    if (!proof) throw Error('SNARK proof should exist')
    arr.push(proof.pi_a[0].toBuffer('be', 32))
    arr.push(proof.pi_a[1].toBuffer('be', 32))
    arr.push(proof.pi_b[0][0].toBuffer('be', 32))
    arr.push(proof.pi_b[0][1].toBuffer('be', 32))
    arr.push(proof.pi_b[1][0].toBuffer('be', 32))
    arr.push(proof.pi_b[1][1].toBuffer('be', 32))
    arr.push(proof.pi_c[0].toBuffer('be', 32))
    arr.push(proof.pi_c[1].toBuffer('be', 32))

    const { swap } = body.txs[i]
    const { memo } = body.txs[i]
    const swapExist = swap ? 1 : 0
    const memoExist = memo ? 2 : 0
    const indicator = swapExist | memoExist
    arr.push(Buffer.from([indicator]))
    if (swap) {
      arr.push(swap.toBuffer('be', 32))
    }
    if (memo) {
      if (memo.byteLength !== 81) throw Error('Memo field should have 81 bytes')
      arr.push(memo)
    }
  }
  // Mass deposits
  const massDepositLenBytes = Utils.hexToBuffer(
    body.massDeposits.length.toString(16),
    1,
  )
  arr.push(massDepositLenBytes)
  for (let i = 0; i < body.massDeposits.length; i += 1) {
    arr.push(Utils.hexToBuffer(body.massDeposits[i].merged, 32))
    arr.push(Utils.hexToBuffer(body.massDeposits[i].fee, 32))
  }
  // Mass migrations
  const massMigrationLenBytes = Utils.hexToBuffer(
    body.massMigrations.length.toString(16),
    1,
  )
  arr.push(massMigrationLenBytes)
  for (let i = 0; i < body.massMigrations.length; i += 1) {
    arr.push(Utils.hexToBuffer(body.massMigrations[i].destination, 20))
    arr.push(Utils.hexToBuffer(body.massMigrations[i].totalETH, 32))
    arr.push(
      Utils.hexToBuffer(body.massMigrations[i].migratingLeaves.merged, 32),
    )
    arr.push(Utils.hexToBuffer(body.massMigrations[i].migratingLeaves.fee, 32))
    const { erc20, erc721 } = body.massMigrations[i]
    arr.push(Utils.hexToBuffer(erc20.length.toString(16), 1))
    for (let j = 0; j < erc20.length; j += 1) {
      arr.push(Utils.hexToBuffer(erc20[j].addr, 20))
      arr.push(Utils.hexToBuffer(erc20[j].amount, 32))
    }
    arr.push(Utils.hexToBuffer(erc721.length.toString(16), 1))
    for (let j = 0; j < erc721.length; j += 1) {
      arr.push(Utils.hexToBuffer(erc721[j].addr, 20))
      const { nfts } = erc721[j]
      arr.push(Utils.hexToBuffer(nfts.length.toString(16), 1))
      for (let k = 0; k < nfts.length; k += 1) {
        arr.push(Utils.hexToBuffer(nfts[k], 32))
      }
    }
  }
  return Buffer.concat(arr)
}

function deserializeHeaderFrom(
  rawData: string,
): { header: Header; rest: string } {
  const queue = new Utils.StringifiedHexQueue(rawData)
  const header: Header = {
    proposer: queue.dequeue(20),
    parentBlock: queue.dequeue(32),
    metadata: queue.dequeue(32),
    fee: queue.dequeue(32),
    utxoRoot: queue.dequeue(32),
    utxoIndex: queue.dequeue(32),
    nullifierRoot: queue.dequeue(32),
    withdrawalRoot: queue.dequeue(32),
    withdrawalIndex: queue.dequeue(32),
    txRoot: queue.dequeue(32),
    depositRoot: queue.dequeue(32),
    migrationRoot: queue.dequeue(32),
  }
  return { header, rest: queue.dequeueAll() }
}

function deserializeTxsFrom(rawData: string): { txs: ZkTx[]; rest: string } {
  const queue = new Utils.StringifiedHexQueue(rawData)
  const txsLength: number = queue.dequeueToNumber(2)
  const txs: ZkTx[] = []
  while (txs.length < txsLength) {
    const numOfInflow: number = queue.dequeueToNumber(1)
    const inflow: ZkInflow[] = []
    while (inflow.length < numOfInflow) {
      inflow.push({
        root: Field.from(queue.dequeue(32)),
        nullifier: Field.from(queue.dequeue(32)),
      })
    }
    const numOfOutflow: number = queue.dequeueToNumber(1)
    const outflow: ZkOutflow[] = []
    while (outflow.length < numOfOutflow) {
      const note = Field.from(queue.dequeue(32))
      const outflowType = Field.from(queue.dequeue(1))
      let data: PublicData | undefined
      if (!outflowType.isZero()) {
        data = {
          to: Field.from(queue.dequeue(20)),
          eth: Field.from(queue.dequeue(32)),
          tokenAddr: Field.from(queue.dequeue(20)),
          erc20Amount: Field.from(queue.dequeue(32)),
          nft: Field.from(queue.dequeue(32)),
          fee: Field.from(queue.dequeue(32)),
        }
      }
      outflow.push({
        note,
        outflowType,
        data,
      })
    }
    const fee = Field.from(queue.dequeue(32))
    const proof: SNARK = {
      pi_a: [Field.from(queue.dequeue(32)), Field.from(queue.dequeue(32))],
      pi_b: [
        [Field.from(queue.dequeue(32)), Field.from(queue.dequeue(32))],
        [Field.from(queue.dequeue(32)), Field.from(queue.dequeue(32))],
      ],
      pi_c: [Field.from(queue.dequeue(32)), Field.from(queue.dequeue(32))],
    }
    const indicator = queue.dequeueToNumber(1)
    let swap: Field | undefined
    if ((indicator & 1) !== 0) {
      // swap exist
      swap = Field.from(queue.dequeue(32))
    }
    let memo: Buffer | undefined
    if ((indicator & 2) !== 0) {
      // memo exist
      memo = queue.dequeueToBuffer(81)
    }
    txs.push(new ZkTx({ inflow, outflow, swap, fee, proof, memo }))
  }
  return { txs, rest: queue.dequeueAll() }
}

function deserializeMassDeposits(
  rawData: string,
): { massDeposits: MassDeposit[]; rest: string } {
  const queue = new Utils.StringifiedHexQueue(rawData)
  const mdLength: number = queue.dequeueToNumber(1)
  const massDeposits: MassDeposit[] = []
  while (massDeposits.length < mdLength) {
    massDeposits.push({
      merged: queue.dequeue(32),
      fee: queue.dequeue(32),
    })
  }
  return { massDeposits, rest: queue.dequeueAll() }
}

function deserializeMassMigrations(
  rawData: string,
): { massMigrations: MassMigration[]; rest: string } {
  const queue = new Utils.StringifiedHexQueue(rawData)
  const mmLength: number = queue.dequeueToNumber(1)
  const massMigrations: MassMigration[] = []
  while (massMigrations.length < mmLength) {
    const destination = queue.dequeue(20)
    const totalETH = queue.dequeue(32)
    const migratingLeaves: MassDeposit = {
      merged: queue.dequeue(32),
      fee: queue.dequeue(32),
    }
    const erc20MigrationLength = queue.dequeueToNumber(1)
    const erc20Migrations: ERC20Migration[] = []
    while (erc20Migrations.length < erc20MigrationLength) {
      erc20Migrations.push({
        addr: queue.dequeue(20),
        amount: queue.dequeue(32),
      })
    }
    const erc721MigrationLength = queue.dequeueToNumber(1)
    const erc721Migrations: ERC721Migration[] = []
    while (erc721Migrations.length < erc721MigrationLength) {
      const addr = queue.dequeue(20)
      const nftLen = queue.dequeueToNumber(1)
      const nfts: string[] = []
      while (nfts.length < nftLen) {
        nfts.push(queue.dequeue(32))
      }
      erc721Migrations.push({
        addr,
        nfts,
      })
    }
    massMigrations.push({
      destination,
      totalETH,
      migratingLeaves,
      erc20: erc20Migrations,
      erc721: erc721Migrations,
    })
  }
  return { massMigrations, rest: queue.dequeueAll() }
}

export function headerHash(header: Header): string {
  const concatenated = Buffer.concat([
    Utils.hexToBuffer(header.proposer, 20),
    Utils.hexToBuffer(header.parentBlock, 32),
    Utils.hexToBuffer(header.metadata, 32),
    Utils.hexToBuffer(header.fee, 32),
    Utils.hexToBuffer(header.utxoRoot, 32),
    Utils.hexToBuffer(header.utxoIndex, 32),
    Utils.hexToBuffer(header.nullifierRoot, 32),
    Utils.hexToBuffer(header.withdrawalRoot, 32),
    Utils.hexToBuffer(header.withdrawalIndex, 32),
    Utils.hexToBuffer(header.txRoot, 32),
    Utils.hexToBuffer(header.depositRoot, 32),
    Utils.hexToBuffer(header.migrationRoot, 32),
  ])
  const result = soliditySha3(`0x${concatenated.toString('hex')}`)
  if (!result) throw Error('Failed to get header hash')
  return result
}

export function massDepositHash(massDeposit: MassDeposit): string {
  const concatenated = Buffer.concat([
    Utils.hexToBuffer(massDeposit.merged, 32),
    Utils.hexToBuffer(massDeposit.fee, 32),
  ])
  const result = soliditySha3(`0x${concatenated.toString('hex')}`)
  if (!result) throw Error('Failed to get header hash')
  return result
}

export function massMigrationHash(massMigration: MassMigration): string {
  let concatenated = Buffer.concat([
    Utils.hexToBuffer(massMigration.destination, 32),
    Utils.hexToBuffer(massMigration.migratingLeaves.merged, 32),
    Utils.hexToBuffer(massMigration.migratingLeaves.fee, 32),
  ])
  for (let i = 0; i < massMigration.erc20.length; i += 1) {
    concatenated = Buffer.concat([
      concatenated,
      Utils.hexToBuffer(massMigration.erc20[i].addr, 20),
      Utils.hexToBuffer(massMigration.erc20[i].amount, 20),
    ])
  }
  for (let i = 0; i < massMigration.erc721.length; i += 1) {
    concatenated = Buffer.concat([
      concatenated,
      Utils.hexToBuffer(massMigration.erc721[i].addr, 20),
      massMigration.erc721[i].nfts.reduce((buff, nft) => {
        return Buffer.concat([buff, Utils.hexToBuffer(nft, 32)])
      }, Buffer.from([])),
    ])
  }
  const result = soliditySha3(`0x${concatenated.toString('hex')}`)
  if (!result) throw Error('Failed to get header hash')
  return result
}

export class Block {
  hash: string

  status: BlockStatus

  proposedAt?: number

  parent: string

  proposalHash: string

  header: Header

  body: Body

  proposalData?: Transaction

  bootstrap?: {
    utxoTreeIndex: number
    utxoBootstrap: string[]
    withdrawalTreeIndex: number
    withdrawalBootstrap: string[]
  }

  constructor({
    hash,
    status,
    proposedAt,
    parent,
    proposalHash,
    header,
    body,
    proposalData,
    bootstrap,
  }: {
    hash: string
    status: BlockStatus
    proposedAt: number
    parent: string
    proposalHash: string
    header: Header
    body: Body
    proposalData?: Transaction
    bootstrap?: {
      utxoTreeIndex: number
      utxoBootstrap: string[]
      withdrawalTreeIndex: number
      withdrawalBootstrap: string[]
    }
  }) {
    this.hash = hash
    this.status = status
    this.proposedAt = proposedAt
    this.parent = parent
    this.proposalHash = proposalHash
    this.header = header
    this.body = body
    this.proposalData = proposalData
    this.bootstrap = bootstrap
  }

  toSqlObj(): BlockSql {
    return {
      hash: this.hash,
      status: this.status,
      proposedAt: this.proposedAt || 0,
      proposalHash: this.proposalHash,
      header: this.header,
      proposalData: this.proposalData ? this.proposalData : undefined,
      bootstrap: this.bootstrap ? this.bootstrap : undefined,
    }
  }

  serializeBlock(): Buffer {
    const arr: Buffer[] = []
    // Header
    const headerBytes = serializeHeader(this.header)
    arr.push(headerBytes)
    const bodyBytes = serializeBody(this.body)
    arr.push(bodyBytes)
    return Buffer.concat(arr)
  }

  static fromTx(tx: Transaction): Block {
    const deserializedHeader = deserializeHeaderFrom(tx.input)
    const deserializedTxs = deserializeTxsFrom(deserializedHeader.rest)
    const deserializedMassDeposits = deserializeMassDeposits(
      deserializedTxs.rest,
    )
    const deserializedMassMigrations = deserializeMassMigrations(
      deserializedMassDeposits.rest,
    )
    const { header } = deserializedHeader
    const { txs } = deserializedTxs
    const { massDeposits } = deserializedMassDeposits
    const { massMigrations } = deserializedMassMigrations
    const body: Body = {
      txs,
      massDeposits,
      massMigrations,
    }
    return new Block({
      hash: headerHash(header),
      status: BlockStatus.FETCHED,
      proposedAt: tx.blockNumber || 0,
      parent: header.parentBlock,
      proposalHash: tx.hash,
      proposalData: tx,
      header,
      body,
    })
  }
}
