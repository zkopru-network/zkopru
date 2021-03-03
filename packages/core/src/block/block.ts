/* eslint-disable @typescript-eslint/camelcase */
import {
  Block as BlockSql,
  Header as HeaderSql,
  // BootstrapCreateInput,
} from '@zkopru/database'
import * as Utils from '@zkopru/utils'
import { soliditySha3Raw } from 'web3-utils'
import { Bytes32, Uint256 } from 'soltypes'
import { Transaction } from 'web3-core'
import assert from 'assert'
import { Finalization, Header, Body } from './types'
import {
  deserializeHeaderFrom,
  deserializeMassDeposits,
  deserializeMassMigrations,
  deserializeTxsFrom,
  headerHash,
  serializeBody,
  serializeHeader,
} from './utils'

export class Block {
  hash: Bytes32

  header: Header

  body: Body

  slashed?: boolean

  verified?: boolean

  bootstrap?: {
    utxoTreeIndex: Uint256
    utxoBootstrap: Uint256[]
    withdrawalTreeIndex: Uint256
    withdrawalBootstrap: Bytes32[]
  }

  constructor({
    hash,
    verified,
    slashed,
    header,
    body,
    bootstrap,
  }: {
    hash: Bytes32
    slashed?: boolean
    verified?: boolean
    header: Header
    body: Body
    bootstrap?: {
      utxoTreeIndex: Uint256
      utxoBootstrap: Uint256[]
      withdrawalTreeIndex: Uint256
      withdrawalBootstrap: Bytes32[]
    }
  }) {
    this.hash = hash
    this.slashed = slashed
    this.verified = verified
    this.header = header
    this.body = body
    this.bootstrap = bootstrap
  }

  getFinalization(): Finalization {
    const data = `0x${this.serializeBlock().toString('hex')}`
    const checksum = soliditySha3Raw(data)
    return {
      proposalChecksum: Bytes32.from(checksum),
      header: this.header,
      massDeposits: this.body.massDeposits,
      massMigration: this.body.massMigrations,
    }
  }

  toSqlObj(): BlockSql {
    return {
      hash: this.hash.toString(),
      proposal: {},
    }
  }

  getHeaderSql(): HeaderSql {
    return {
      hash: this.hash.toString(),
      proposer: this.header.proposer.toString(),
      parentBlock: this.header.parentBlock.toString(),
      fee: this.header.fee.toString(),
      utxoRoot: this.header.utxoRoot.toString(),
      utxoIndex: this.header.utxoIndex.toString(),
      nullifierRoot: this.header.nullifierRoot.toString(),
      withdrawalRoot: this.header.withdrawalRoot.toString(),
      withdrawalIndex: this.header.withdrawalIndex.toString(),
      txRoot: this.header.txRoot.toString(),
      depositRoot: this.header.depositRoot.toString(),
      migrationRoot: this.header.migrationRoot.toString(),
    }
  }

  getSqlObjs(): {
    block: BlockSql
    header: HeaderSql
    bootstrap: any | undefined
  } {
    const hash = this.hash.toString()
    const block = this.toSqlObj()
    const header = this.getHeaderSql()
    const bootstrap = this.bootstrap
      ? {
          blockHash: hash,
          utxoTreeIndex: parseInt(this.bootstrap.utxoTreeIndex.toString(), 10),
          utxoBootstrap: JSON.stringify(
            this.bootstrap.utxoBootstrap.map(val => val.toString()),
          ),
          withdrawalTreeIndex: parseInt(
            this.bootstrap.withdrawalTreeIndex.toString(),
            10,
          ),
          withdrawalBootstrap: JSON.stringify(
            this.bootstrap.withdrawalBootstrap.map(val => val.toString()),
          ),
        }
      : undefined
    return { block, header, bootstrap }
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

  static fromTx(tx: Transaction, verified?: boolean): Block {
    const queue = new Utils.StringifiedHexQueue(tx.input)
    // remove function selector
    const selector = queue.dequeue(4)
    const paramPosition = queue.dequeue(32)
    const bytesLength = queue.dequeue(32)
    assert([selector, paramPosition, bytesLength])
    const rawData = queue.dequeueAll()
    return Block.from(rawData, verified)
  }

  static from(data: string | Buffer, verified?: boolean): Block {
    const rawData = Utils.hexify(data)
    const deserializedHeader = deserializeHeaderFrom(rawData)
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
      verified,
      header,
      body,
    })
  }
}
