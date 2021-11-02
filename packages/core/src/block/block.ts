/* eslint-disable @typescript-eslint/camelcase */
import {
  Block as BlockSql,
  Header as HeaderSql,
  // BootstrapCreateInput,
} from '@zkopru/database'
import * as Utils from '@zkopru/utils'
import { logger } from '@zkopru/utils'
import { soliditySha3Raw } from 'web3-utils'
import AbiCoder from 'web3-eth-abi'
import { Bytes32, Uint256 } from 'soltypes'
import { Transaction } from 'web3-core'
// import assert from 'assert'
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
    logger.trace(
      `core/block.ts - Block::constructor(${hash.toString().slice(0, 6)}...)`,
    )
    this.hash = hash
    this.slashed = slashed
    this.verified = verified
    this.header = header
    this.body = body
    this.bootstrap = bootstrap
  }

  getFinalization(): Finalization {
    logger.trace(
      `core/block.ts - Block(${this.hash
        .toString()
        .slice(0, 6)}...)::getFinalization()`,
    )
    return {
      proposalChecksum: Bytes32.from(this.checksum()),
      header: this.header,
      massDeposits: this.body.massDeposits,
    }
  }

  toSqlObj(): BlockSql {
    logger.trace(
      `core/block.ts - Block(${this.hash
        .toString()
        .slice(0, 6)}...)::toSqlObj()`,
    )
    return {
      hash: this.hash.toString(),
      proposal: {},
    }
  }

  getHeaderSql(): HeaderSql {
    logger.trace(
      `core/block.ts - Block(${this.hash
        .toString()
        .slice(0, 6)}...)::toHeaderSql()`,
    )
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
    logger.trace(
      `core/block.ts - Block(${this.hash
        .toString()
        .slice(0, 6)}...)::getSqlObjs()`,
    )
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
    logger.trace(
      `core/block.ts - Block(${this.hash
        .toString()
        .slice(0, 6)}...)::serializeBlock()`,
    )
    const arr: Buffer[] = []
    // Header
    const headerBytes = serializeHeader(this.header)
    arr.push(headerBytes)
    const bodyBytes = serializeBody(this.body)
    arr.push(bodyBytes)
    return Buffer.concat(arr)
  }

  // The block checksum, not just the header hash
  checksum() {
    logger.trace(
      `core/block.ts - Block(${this.hash
        .toString()
        .slice(0, 6)}...)::checksum()`,
    )
    const data = `0x${this.serializeBlock().toString('hex')}`
    return soliditySha3Raw(data)
  }

  static fromTx(tx: Transaction, verified?: boolean): Block {
    logger.trace(`core/block.ts - Block::fromTx(${tx.hash.slice(0, 6)}...)`)
    const queue = new Utils.StringifiedHexQueue(tx.input)
    // remove function selector
    const selector = queue.dequeue(4).toString()
    const data = queue.dequeueAll()
    // Type issues come from the web3 typings
    // https://github.com/ChainSafe/web3.js/pull/4100
    const encodeFunctionSignature = (AbiCoder as any).encodeFunctionSignature.bind(
      AbiCoder,
    )
    const decodeParameters = (AbiCoder as any).decodeParameters.bind(AbiCoder)
    if (selector === encodeFunctionSignature('propose(bytes)')) {
      return Block.from(decodeParameters(['bytes'], data)['0'], verified)
    }
    if (
      selector ===
      encodeFunctionSignature('safePropose(bytes,bytes32,bytes32[])')
    ) {
      return Block.from(
        decodeParameters(['bytes', 'bytes32', 'bytes32[]'], data)['0'],
        verified,
      )
    }
    throw new Error('Unrecognized selector')
  }

  static fromJSON(data: string) {
    logger.trace(`core/block.ts - Block::fromJSON(...)`)
    return this.fromTx(JSON.parse(data))
  }

  static from(data: string | Buffer, verified?: boolean): Block {
    logger.trace(`core/block.ts - Block::from(...)`)
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
