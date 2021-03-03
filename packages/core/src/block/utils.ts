/* eslint-disable @typescript-eslint/camelcase */
import {
  ZkTx,
  ZkInflow,
  ZkOutflow,
  PublicData,
  SNARK,
  OutflowType,
} from '@zkopru/transaction'
import { Header as HeaderSql } from '@zkopru/database'
import * as Utils from '@zkopru/utils'
import { Fp } from '@zkopru/babyjubjub'
import { soliditySha3Raw } from 'web3-utils'
import { Bytes32, Uint256, Address } from 'soltypes'
import {
  Body,
  ERC20Migration,
  ERC721Migration,
  Finalization,
  Header,
  MassDeposit,
  MassMigration,
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
    arr.push(massMigrations[i].totalETH.toBuffer())
    arr.push(massMigrations[i].migratingLeaves.merged.toBuffer())
    arr.push(massMigrations[i].migratingLeaves.fee.toBuffer())
    const { erc20, erc721 } = massMigrations[i]
    arr.push(Utils.numToBuffer(erc20.length, 1))
    for (let j = 0; j < erc20.length; j += 1) {
      arr.push(erc20[j].addr.toBuffer())
      arr.push(erc20[j].amount.toBuffer())
    }
    arr.push(Utils.numToBuffer(erc721.length, 1))
    for (let j = 0; j < erc721.length; j += 1) {
      arr.push(erc721[j].addr.toBuffer())
      const { nfts } = erc721[j]
      arr.push(Utils.numToBuffer(nfts.length, 1))
      for (let k = 0; k < nfts.length; k += 1) {
        arr.push(nfts[k].toBuffer())
      }
    }
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
    serializeMassMigrations(finalization.massMigration),
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
    let memo: Buffer | undefined
    if ((indicator & 2) !== 0) {
      // memo exist
      memo = queue.dequeueToBuffer(81)
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
    const destination = queue.dequeue(20)
    const totalETH = queue.dequeueToUint256()
    const migratingLeaves: MassDeposit = {
      merged: queue.dequeueToBytes32(),
      fee: queue.dequeueToUint256(),
    }
    const erc20MigrationLength = queue.dequeueToNumber(1)
    const erc20Migrations: ERC20Migration[] = []
    while (erc20Migrations.length < erc20MigrationLength) {
      erc20Migrations.push({
        addr: queue.dequeueToAddress(),
        amount: queue.dequeueToUint256(),
      })
    }
    const erc721MigrationLength = queue.dequeueToNumber(1)
    const erc721Migrations: ERC721Migration[] = []
    while (erc721Migrations.length < erc721MigrationLength) {
      const addr = queue.dequeue(20)
      const nftLen = queue.dequeueToNumber(1)
      const nfts: Uint256[] = []
      while (nfts.length < nftLen) {
        nfts.push(queue.dequeueToUint256())
      }
      erc721Migrations.push({
        addr: Address.from(addr),
        nfts,
      })
    }
    massMigrations.push({
      destination: Address.from(destination),
      totalETH,
      migratingLeaves,
      erc20: erc20Migrations,
      erc721: erc721Migrations,
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
  const result = soliditySha3Raw(`0x${concatenated.toString('hex')}`)
  return Bytes32.from(result)
}

export function massDepositHash(massDeposit: MassDeposit): Bytes32 {
  const concatenated = Buffer.concat(
    [massDeposit.merged, massDeposit.fee].map(val => val.toBuffer()),
  )
  const result = soliditySha3Raw(`0x${concatenated.toString('hex')}`)
  return Bytes32.from(result)
}

export function massMigrationHash(massMigration: MassMigration): Bytes32 {
  let concatenated = Buffer.concat(
    [
      massMigration.destination,
      massMigration.migratingLeaves.merged,
      massMigration.migratingLeaves.fee,
    ].map(val => val.toBuffer()),
  )
  for (let i = 0; i < massMigration.erc20.length; i += 1) {
    concatenated = Buffer.concat([
      concatenated,
      massMigration.erc20[i].addr.toBuffer(),
      massMigration.erc20[i].amount.toBuffer(),
    ])
  }
  for (let i = 0; i < massMigration.erc721.length; i += 1) {
    concatenated = Buffer.concat([
      concatenated,
      massMigration.erc721[i].addr.toBuffer(),
      massMigration.erc721[i].nfts.reduce((buff, nft) => {
        return Buffer.concat([buff, nft.toBuffer()])
      }, Buffer.from([])),
    ])
  }
  const result = soliditySha3Raw(`0x${concatenated.toString('hex')}`)
  return Bytes32.from(result)
}

export function getErc20Migrations(notes: ZkOutflow[]): ERC20Migration[] {
  const erc20Notes = notes.filter(note => note.data?.erc20Amount !== undefined)
  const erc20Addresses = erc20Notes
    .map(note => note.data?.tokenAddr.toHex())
    .filter((v, i, self) => self.indexOf(v) === i)

  const erc20Migrations: ERC20Migration[] = []
  for (const addr of erc20Addresses) {
    if (!addr) break
    const targetNotes = erc20Notes.filter(note =>
      note.data?.tokenAddr.eq(Fp.from(addr)),
    )
    const amount: Uint256 = targetNotes
      .reduce(
        (acc, note) => acc.add(note.data?.erc20Amount || Fp.zero),
        Fp.zero,
      )
      .toUint256()
    erc20Migrations.push({
      addr: Address.from(addr),
      amount,
    })
  }
  return erc20Migrations
}

export function getErc721Migrations(notes: ZkOutflow[]): ERC721Migration[] {
  const erc721Notes = notes.filter(note => note.data?.nft !== undefined)
  const erc721Addresses = erc721Notes
    .map(note => note.data?.tokenAddr.toHex())
    .filter((v, i, self) => self.indexOf(v) === i)
  const erc721Migrations: ERC721Migration[] = []
  for (const addr of erc721Addresses) {
    if (!addr) break
    const targetNotes = erc721Notes.filter(note =>
      note.data?.tokenAddr.eq(Fp.from(addr)),
    )
    const nfts: Uint256[] = targetNotes
      .map(note => note.data?.nft || Fp.zero)
      .map(nft => nft.toUint256())
    erc721Migrations.push({
      addr: Address.from(addr),
      nfts,
    })
  }
  return erc721Migrations
}

export function getMassMigrationToAddress(
  dest: string,
  migratingNotes: ZkOutflow[],
): MassMigration {
  const notes = migratingNotes.filter(note => note.data?.to.eq(Fp.from(dest)))
  const totalETH = notes
    .reduce((acc, note) => acc.add(note.data?.eth || Fp.zero), Fp.zero)
    .toUint256()
  const migratingLeaves: MassDeposit = Utils.mergeDeposits(
    notes.map(note => ({
      note: note.note.toBytes32(),
      fee: note.data?.fee.toUint256() || Uint256.from(''),
    })),
  )
  const erc20Migrations: ERC20Migration[] = getErc20Migrations(notes)
  const erc721Migrations: ERC721Migration[] = getErc721Migrations(notes)
  return {
    destination: Address.from(dest),
    migratingLeaves,
    totalETH,
    erc20: erc20Migrations,
    erc721: erc721Migrations,
  }
}

export function getMassMigrations(txs: ZkTx[]): MassMigration[] {
  const migratingNotes: ZkOutflow[] = []
  for (const tx of txs) {
    for (const outflow of tx.outflow) {
      if (outflow.outflowType.eqn(OutflowType.MIGRATION)) {
        migratingNotes.push(outflow)
      }
    }
  }
  const destinations = migratingNotes
    .map(note => note.data?.to.toHex())
    .filter((v, i, self) => self.indexOf(v) === i)
  const migrations: MassMigration[] = []
  for (const dest of destinations) {
    if (!dest) break
    migrations.push(getMassMigrationToAddress(dest, migratingNotes))
  }
  return migrations
}
