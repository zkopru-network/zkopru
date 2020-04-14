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

export interface Block {
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
}

export function blockToSqlObj(block: Block): BlockSql {
  return {
    hash: block.hash,
    status: block.status,
    proposedAt: block.proposedAt,
    proposalHash: block.proposalHash,
    header: block.header,
    proposalData: block.proposalData ? block.proposalData : undefined,
    bootstrap: block.bootstrap ? block.bootstrap : undefined,
  }
}

export function serializeBlock(block: Block): Buffer {
  const arr: Buffer[] = []
  // Header
  const headerBytes = Buffer.concat([
    Utils.hexToBuffer(block.header.proposer, 20),
    Utils.hexToBuffer(block.header.parentBlock, 32),
    Utils.hexToBuffer(block.header.metadata, 32),
    Utils.hexToBuffer(block.header.fee, 32),
    Utils.hexToBuffer(block.header.utxoRoot, 32),
    Utils.hexToBuffer(block.header.utxoIndex, 32),
    Utils.hexToBuffer(block.header.nullifierRoot, 32),
    Utils.hexToBuffer(block.header.withdrawalRoot, 32),
    Utils.hexToBuffer(block.header.withdrawalIndex, 32),
    Utils.hexToBuffer(block.header.txRoot, 32),
    Utils.hexToBuffer(block.header.depositRoot, 32),
    Utils.hexToBuffer(block.header.migrationRoot, 32),
  ])
  arr.push(headerBytes)
  // Txs
  const txLenBytes = Utils.hexToBuffer(block.body.txs.length.toString(16), 2)
  arr.push(txLenBytes)
  for (let i = 0; i < block.body.txs.length; i += 1) {
    const numOfInflowByte = Utils.hexToBuffer(
      block.body.txs[i].inflow.length.toString(16),
      1,
    )
    arr.push(numOfInflowByte)
    for (let j = 0; j < block.body.txs[i].inflow.length; j += 1) {
      arr.push(block.body.txs[i].inflow[j].nullifier.toBuffer(32))
      arr.push(block.body.txs[i].inflow[j].root.toBuffer(32))
    }
    const numOfOutflowByte = Utils.hexToBuffer(
      block.body.txs[i].outflow.length.toString(16),
      1,
    )
    arr.push(numOfOutflowByte)
    for (let j = 0; j < block.body.txs[i].outflow.length; j += 1) {
      arr.push(block.body.txs[i].outflow[j].note.toBuffer(32))
      arr.push(block.body.txs[i].outflow[j].outflowType.toBuffer(1))
      const { data } = block.body.txs[i].outflow[j]
      if (data) {
        arr.push(data.to.toBuffer(20))
        arr.push(data.eth.toBuffer(32))
        arr.push(data.tokenAddr.toBuffer(20))
        arr.push(data.erc20Amount.toBuffer(32))
        arr.push(data.nft.toBuffer(32))
        arr.push(data.fee.toBuffer(32))
      } else if (block.body.txs[i].outflow[j].outflowType.isZero()) {
        throw Error('public data should exist')
      }
    }
    const swapExistenceByte = block.body.txs[i].swap
      ? Buffer.from([1])
      : Buffer.from([0])
    arr.push(swapExistenceByte)
    const { swap } = block.body.txs[i]
    if (swap) {
      arr.push(swap.toBuffer(32))
    }
    arr.push(block.body.txs[i].fee.toBuffer(32))
    const { proof } = block.body.txs[i]
    if (!proof) throw Error('SNARK proof should exist')
    arr.push(proof.pi_a[0].toBuffer(32))
    arr.push(proof.pi_a[1].toBuffer(32))
    arr.push(proof.pi_b[0][0].toBuffer(32))
    arr.push(proof.pi_b[0][1].toBuffer(32))
    arr.push(proof.pi_b[1][0].toBuffer(32))
    arr.push(proof.pi_b[1][1].toBuffer(32))
    arr.push(proof.pi_c[0].toBuffer(32))
    arr.push(proof.pi_c[1].toBuffer(32))
    const { memo } = block.body.txs[i]
    const memoExistenceByte = memo
      ? Buffer.from([memo.byteLength])
      : Buffer.from([0])
    arr.push(memoExistenceByte)
    if (memo) {
      arr.push(memo)
      if (memo.byteLength > 256) throw Error('Memo field allows only 256 bytes')
    }
  }
  // Mass deposits
  const massDepositLenBytes = Utils.hexToBuffer(
    block.body.massDeposits.length.toString(16),
    1,
  )
  arr.push(massDepositLenBytes)
  for (let i = 0; i < block.body.massDeposits.length; i += 1) {
    arr.push(Utils.hexToBuffer(block.body.massDeposits[i].merged, 32))
    arr.push(Utils.hexToBuffer(block.body.massDeposits[i].fee, 32))
  }
  // Mass migrations
  const massMigrationLenBytes = Utils.hexToBuffer(
    block.body.massMigrations.length.toString(16),
    1,
  )
  arr.push(massMigrationLenBytes)
  for (let i = 0; i < block.body.massMigrations.length; i += 1) {
    arr.push(Utils.hexToBuffer(block.body.massMigrations[i].destination, 20))
    arr.push(Utils.hexToBuffer(block.body.massMigrations[i].totalETH, 32))
    arr.push(
      Utils.hexToBuffer(
        block.body.massMigrations[i].migratingLeaves.merged,
        32,
      ),
    )
    arr.push(
      Utils.hexToBuffer(block.body.massMigrations[i].migratingLeaves.fee, 32),
    )
    const { erc20, erc721 } = block.body.massMigrations[i]
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
        nullifier: Field.from(queue.dequeue(32)),
        root: Field.from(queue.dequeue(32)),
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
    const swapExistence = queue.dequeueToNumber(1)
    let swap: Field | undefined
    if (swapExistence) {
      swap = Field.from(queue.dequeue(32))
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
    const hasMemo = queue.dequeueToNumber(1)
    let memo: Buffer | undefined
    if (hasMemo) {
      memo = queue.dequeueToBuffer(32)
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

export function deserializeBlockFromL1Tx(tx: Transaction): Block {
  const deserializedHeader = deserializeHeaderFrom(tx.input)
  const deserializedTxs = deserializeTxsFrom(deserializedHeader.rest)
  const deserializedMassDeposits = deserializeMassDeposits(deserializedTxs.rest)
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
  return {
    hash: headerHash(header),
    status: BlockStatus.FETCHED,
    proposedAt: tx.blockNumber || 0,
    parent: header.parentBlock,
    proposalHash: tx.hash,
    proposalData: tx,
    header,
    body,
  }
}
