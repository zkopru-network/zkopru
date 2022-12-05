/* eslint-disable @typescript-eslint/camelcase */
import {
  ZkTx,
  ZkInflow,
  ZkOutflow,
  PublicData,
  SNARK,
  OutflowType,
  Memo,
  MemoVersion,
} from '@zkopru/transaction'
import { Header as HeaderSql } from '@zkopru/database'
import * as Utils from '@zkopru/utils'
import { Fp } from '@zkopru/babyjubjub'
import { Bytes32, Uint256, Address } from 'soltypes'
import { ethers } from 'ethers'
import {
  Body,
  Finalization,
  Header,
  MassDeposit,
  MassMigration,
  MigrationAsset,
} from './types'

export function headerToSql(header: Header): HeaderSql {
  const sql: HeaderSql = {} as HeaderSql
  Object.keys(header).forEach(key => {
    sql[key] = header[key].toString()
  })
  return sql
}

export function sqlToHeader(sql: HeaderSql): Header {
  return {
    proposer: Address.from(sql.proposer),
    parentBlock: Bytes32.from(sql.parentBlock),
    fee: Uint256.from(sql.fee),
    utxoRoot: Uint256.from(sql.utxoRoot),
    utxoIndex: Uint256.from(sql.utxoIndex),
    nullifierRoot: Bytes32.from(sql.nullifierRoot),
    withdrawalRoot: Uint256.from(sql.withdrawalRoot),
    withdrawalIndex: Uint256.from(sql.withdrawalIndex),
    txRoot: Bytes32.from(sql.txRoot),
    depositRoot: Bytes32.from(sql.depositRoot),
    migrationRoot: Bytes32.from(sql.migrationRoot),
  }
}

export function serializeHeader(header: Header): Buffer {
  // Header
  const headerBytes = Buffer.concat(
    [
      header.proposer,
      header.parentBlock,
      header.fee,
      header.utxoRoot,
      header.utxoIndex,
      header.nullifierRoot,
      header.withdrawalRoot,
      header.withdrawalIndex,
      header.txRoot,
      header.depositRoot,
      header.migrationRoot,
    ].map(val => val.toBuffer()),
  )
  return headerBytes
}

export function serializeTxs(txs: ZkTx[]): Buffer {
  const arr: Buffer[] = []
  // Txs
  const txLenBytes = Utils.numToBuffer(txs.length, 2)
  arr.push(txLenBytes)
  for (let i = 0; i < txs.length; i += 1) {
    const numOfInflowByte = Utils.numToBuffer(txs[i].inflow.length, 1)
    arr.push(numOfInflowByte)
    for (let j = 0; j < txs[i].inflow.length; j += 1) {
      arr.push(txs[i].inflow[j].root.toBuffer('be', 32))
      arr.push(txs[i].inflow[j].nullifier.toBuffer('be', 32))
    }
    const numOfOutflowByte = Utils.numToBuffer(txs[i].outflow.length, 1)
    arr.push(numOfOutflowByte)
    for (let j = 0; j < txs[i].outflow.length; j += 1) {
      arr.push(txs[i].outflow[j].note.toBuffer('be', 32))
      arr.push(txs[i].outflow[j].outflowType.toBuffer('be', 1))
      const { data } = txs[i].outflow[j]
      if (data) {
        arr.push(data.to.toBuffer('be', 20))
        arr.push(data.eth.toBuffer('be', 32))
        arr.push(data.tokenAddr.toBuffer('be', 20))
        arr.push(data.erc20Amount.toBuffer('be', 32))
        arr.push(data.nft.toBuffer('be', 32))
        arr.push(data.fee.toBuffer('be', 32))
      } else if (!txs[i].outflow[j].outflowType.isZero()) {
        throw Error('public data should exist')
      }
    }
    arr.push(txs[i].fee.toBuffer('be', 32))
    const { proof } = txs[i]
    if (!proof) throw Error('SNARK proof should exist')
    arr.push(proof.pi_a[0].toBuffer('be', 32))
    arr.push(proof.pi_a[1].toBuffer('be', 32))
    // caution: snarkjs G2Point is reversed
    arr.push(proof.pi_b[0][1].toBuffer('be', 32))
    arr.push(proof.pi_b[0][0].toBuffer('be', 32))
    arr.push(proof.pi_b[1][1].toBuffer('be', 32))
    arr.push(proof.pi_b[1][0].toBuffer('be', 32))
    arr.push(proof.pi_c[0].toBuffer('be', 32))
    arr.push(proof.pi_c[1].toBuffer('be', 32))

    const { swap } = txs[i]
    const { memo } = txs[i]
    const swapExist = swap ? 1 : 0
    const memoV1 = memo?.version === MemoVersion.V1 ? 2 : 0
    const memoV2 = memo?.version === MemoVersion.V2 ? 4 : 0
    const indicator = swapExist | memoV1 | memoV2
    arr.push(Buffer.from([indicator]))
    if (swap) {
      arr.push(swap.toBuffer('be', 32))
    }
    if (memo) {
      if (memo.version === MemoVersion.V1) {
        if (memo.data.byteLength !== 81)
          throw Error('Memo field should have 81 bytes')
        arr.push(memo.data)
      } else if (memo.version === MemoVersion.V2) {
        arr.push(Fp.from(memo.data.length).toBuffer('be', 2))
        arr.push(memo.data)
      } else {
        throw Error(`Unsupported version: ${memo.version}`)
      }
    }
  }
  return Buffer.concat(arr)
}

export function serializeMassDeposits(massDeposits: MassDeposit[]): Buffer {
  const arr: Buffer[] = []
  // Mass deposits
  const massDepositLenBytes = Utils.numToBuffer(massDeposits.length, 1)
  arr.push(massDepositLenBytes)
  for (let i = 0; i < massDeposits.length; i += 1) {
    arr.push(massDeposits[i].merged.toBuffer())
    arr.push(massDeposits[i].fee.toBuffer())
  }
  return Buffer.concat(arr)
}

export function serializeMassMigrations(
  massMigrations: MassMigration[],
): Buffer {
  const arr: Buffer[] = []
  // Mass migrations
  const massMigrationLenBytes = Utils.numToBuffer(massMigrations.length, 1)
  arr.push(massMigrationLenBytes)
  for (let i = 0; i < massMigrations.length; i += 1) {
    arr.push(massMigrations[i].destination.toBuffer())
    arr.push(massMigrations[i].asset.eth.toBuffer())
    arr.push(massMigrations[i].asset.token.toBuffer())
    arr.push(massMigrations[i].asset.amount.toBuffer())
    arr.push(massMigrations[i].depositForDest.merged.toBuffer())
    arr.push(massMigrations[i].depositForDest.fee.toBuffer())
  }
  return Buffer.concat(arr)
}

export function serializeBody(body: Body): Buffer {
  return Buffer.concat([
    serializeTxs(body.txs),
    serializeMassDeposits(body.massDeposits),
    serializeMassMigrations(body.massMigrations),
  ])
}

export function serializeFinalization(finalization: Finalization): Buffer {
  return Buffer.concat([
    finalization.proposalChecksum.toBuffer(),
    serializeHeader(finalization.header),
    serializeMassDeposits(finalization.massDeposits),
  ])
}

export function deserializeHeaderFrom(
  rawData: string,
): { header: Header; rest: string } {
  const queue = new Utils.StringifiedHexQueue(rawData)
  const header: Header = {
    proposer: queue.dequeueToAddress(),
    parentBlock: queue.dequeueToBytes32(),
    fee: queue.dequeueToUint256(),
    utxoRoot: queue.dequeueToUint256(),
    utxoIndex: queue.dequeueToUint256(),
    nullifierRoot: queue.dequeueToBytes32(),
    withdrawalRoot: queue.dequeueToUint256(),
    withdrawalIndex: queue.dequeueToUint256(),
    txRoot: queue.dequeueToBytes32(),
    depositRoot: queue.dequeueToBytes32(),
    migrationRoot: queue.dequeueToBytes32(),
  }
  return { header, rest: queue.dequeueAll() }
}

export function deserializeTxsFrom(
  rawData: string,
): { txs: ZkTx[]; rest: string } {
  const queue = new Utils.StringifiedHexQueue(rawData)
  const txsLength: number = queue.dequeueToNumber(2)
  const txs: ZkTx[] = []
  while (txs.length < txsLength) {
    const numOfInflow: number = queue.dequeueToNumber(1)
    const inflow: ZkInflow[] = []
    while (inflow.length < numOfInflow) {
      inflow.push({
        root: Fp.from(queue.dequeue(32)),
        nullifier: Fp.from(queue.dequeue(32)),
      })
    }
    const numOfOutflow: number = queue.dequeueToNumber(1)
    const outflow: ZkOutflow[] = []
    while (outflow.length < numOfOutflow) {
      const note = Fp.from(queue.dequeue(32))
      const outflowType = Fp.from(queue.dequeue(1))
      let data: PublicData | undefined
      if (!outflowType.isZero()) {
        data = {
          to: Fp.from(queue.dequeue(20)),
          eth: Fp.from(queue.dequeue(32)),
          tokenAddr: Fp.from(queue.dequeue(20)),
          erc20Amount: Fp.from(queue.dequeue(32)),
          nft: Fp.from(queue.dequeue(32)),
          fee: Fp.from(queue.dequeue(32)),
        }
      }
      outflow.push({
        note,
        outflowType,
        data,
      })
    }
    const fee = Fp.from(queue.dequeue(32))
    const proof: SNARK = {
      pi_a: [Fp.from(queue.dequeue(32)), Fp.from(queue.dequeue(32))],
      pi_b: [
        [Fp.from(queue.dequeue(32)), Fp.from(queue.dequeue(32))].reverse(),
        [Fp.from(queue.dequeue(32)), Fp.from(queue.dequeue(32))].reverse(),
      ],
      pi_c: [Fp.from(queue.dequeue(32)), Fp.from(queue.dequeue(32))],
    }
    const indicator = queue.dequeueToNumber(1)
    let swap: Fp | undefined
    if ((indicator & 1) !== 0) {
      // swap exist
      swap = Fp.from(queue.dequeue(32))
    }
    let memo: Memo | undefined
    if ((indicator & 2) !== 0) {
      // v1 memo exist
      memo = {
        version: 1,
        data: queue.dequeueToBuffer(81),
      }
    } else if ((indicator & 4) !== 0) {
      // v2 memo exist
      const len = queue.dequeueToNumber(2)
      memo = {
        version: 2,
        data: queue.dequeueToBuffer(len),
      }
    }
    txs.push(new ZkTx({ inflow, outflow, swap, fee, proof, memo }))
  }
  return { txs, rest: queue.dequeueAll() }
}

export function deserializeMassDeposits(
  rawData: string,
): { massDeposits: MassDeposit[]; rest: string } {
  const queue = new Utils.StringifiedHexQueue(rawData)
  const mdLength: number = queue.dequeueToNumber(1)
  const massDeposits: MassDeposit[] = []
  while (massDeposits.length < mdLength) {
    massDeposits.push({
      merged: queue.dequeueToBytes32(),
      fee: queue.dequeueToUint256(),
    })
  }
  return { massDeposits, rest: queue.dequeueAll() }
}

export function deserializeMassMigrations(
  rawData: string,
): { massMigrations: MassMigration[]; rest: string } {
  const queue = new Utils.StringifiedHexQueue(rawData)
  const mmLength: number = queue.dequeueToNumber(1)
  const massMigrations: MassMigration[] = []
  while (massMigrations.length < mmLength) {
    const destination = queue.dequeueToAddress()
    const asset: MigrationAsset = {
      eth: queue.dequeueToUint256(),
      token: queue.dequeueToAddress(),
      amount: queue.dequeueToUint256(),
    }
    const depositForDest: MassDeposit = {
      merged: queue.dequeueToBytes32(),
      fee: queue.dequeueToUint256(),
    }
    massMigrations.push({
      destination,
      asset,
      depositForDest,
    })
  }
  return { massMigrations, rest: queue.dequeueAll() }
}

export function headerHash(header: Header): Bytes32 {
  const concatenated = Buffer.concat(
    [
      header.proposer,
      header.parentBlock,
      header.fee,
      header.utxoRoot,
      header.utxoIndex,
      header.nullifierRoot,
      header.withdrawalRoot,
      header.withdrawalIndex,
      header.txRoot,
      header.depositRoot,
      header.migrationRoot,
    ].map(val => val.toBuffer()),
  )
  const result = ethers.utils.keccak256(concatenated)
  return Bytes32.from(result)
}

export function massDepositHash(massDeposit: MassDeposit): Bytes32 {
  const concatenated = Buffer.concat(
    [massDeposit.merged, massDeposit.fee].map(val => val.toBuffer()),
  )
  const result = ethers.utils.keccak256(concatenated)
  return Bytes32.from(result)
}

export function massMigrationHash(massMigration: MassMigration): Bytes32 {
  const concatenated = Buffer.concat(
    [
      massMigration.destination,
      massMigration.asset.eth,
      massMigration.asset.token,
      massMigration.asset.amount,
      massMigration.depositForDest.merged,
      massMigration.depositForDest.fee,
    ].map(val => val.toBuffer()),
  )
  const result = ethers.utils.keccak256(concatenated)
  return Bytes32.from(result)
}

export function getMassMigrationForToken(
  destination: Address,
  token: Address,
  migratingNotes: ZkOutflow[],
): MassMigration {
  const notes = migratingNotes
    .filter(note => note.data?.to.eq(destination.toBigNumber()))
    .filter(note => note.data?.tokenAddr.eq(token.toBigNumber()))
  const eth = notes
    .reduce((acc, note) => acc.add(note.data?.eth || Fp.zero), Fp.zero)
    .toUint256()
  const amount = notes
    .reduce((acc, note) => acc.add(note.data?.erc20Amount || Fp.zero), Fp.zero)
    .toUint256()
  const depositForDest: MassDeposit = Utils.mergeDeposits(
    notes.map(note => ({
      note: note.note.toBytes32(),
      fee: note.data?.fee.toUint256() || Uint256.from(''),
    })),
  )
  return {
    destination,
    asset: {
      eth,
      token,
      amount,
    },
    depositForDest,
  }
}

export function getMassMigrations(txs: ZkTx[]): MassMigration[] {
  const migratingNotes: ZkOutflow[] = txs
    .reduce((acc, tx) => [...acc, ...tx.outflow], [] as ZkOutflow[])
    .filter(outflow => outflow.outflowType.eq(OutflowType.MIGRATION))

  const tokens = migratingNotes
    .map(note => note.data?.tokenAddr)
    .map(addr => addr?.toHexString())
    .filter((v, i, self) => self.indexOf(v) === i)
    .map(addr => Address.from(addr as string))

  const destinations = migratingNotes
    .map(note => note.data?.to.toHexString())
    .filter((v, i, self) => self.indexOf(v) === i)
    .map(addr => Address.from(addr as string))

  const migrations: MassMigration[] = []
  for (const dest of destinations) {
    for (const token of tokens) {
      migrations.push(getMassMigrationForToken(dest, token, migratingNotes))
    }
  }
  return migrations
}
