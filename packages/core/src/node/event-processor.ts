import { BigNumber, utils } from 'ethers'
import { TypedEvent } from '@zkopru/contracts/typechain/common'
import {
  Deposit as DepositSql,
  Utxo as UtxoSql,
  MassDeposit as MassDepositSql,
  TokenRegistry as TokenRegistrySql,
  TransactionDB,
} from '@zkopru/database'
import { Bytes32, Address } from 'soltypes'
import { Note, ZkAddress } from '@zkopru/transaction'
import { Fp } from '@zkopru/babyjubjub'
import { logger } from '@zkopru/utils'
import { EventEmitter } from 'events'
import { Provider } from '@ethersproject/providers'

export class EventProcessor extends EventEmitter {
  provider: Provider

  constructor(_provider: Provider) {
    super()
    this.provider = _provider
  }

  handleDepositEvents = (
    events: TypedEvent<
      [BigNumber, BigNumber, BigNumber] & {
        queuedAt: BigNumber
        note: BigNumber
        fee: BigNumber
      }
    >[],
    db: TransactionDB,
    cb?: (deposit: DepositSql) => void,
  ) => {
    if (Array.isArray(events)) {
      logger.info(`core/event-processor - ${events.length} Deposits`)
    }
    for (const event of [events].flat()) {
      const { args, logIndex, transactionIndex, blockNumber } = event
      const { note, fee, queuedAt } = args
      const depositHash = utils.keccak256(Buffer.concat([
        Buffer.from(blockNumber.toString()),
        Buffer.from(transactionIndex.toString()),
        Buffer.from(queuedAt.toString()),
        Buffer.from(note.toString()),
        Buffer.from(fee.toString())
      ]))
      const deposit: DepositSql = {
        id: depositHash,
        note: note.toString(),
        fee: fee.toString(),
        queuedAt: queuedAt.toString(),
        transactionIndex,
        logIndex,
        blockNumber
      }
      try {
        db.upsert('Deposit', {
          where: { id: depositHash },
          update: deposit,
          create: deposit,
        })
      } catch (error) {
        logger.error(`core/even-processor - deposit upsert error: ${error}`)
      }
      db.delete('PendingDeposit', {
        where: {
          note: deposit.note,
        },
      })
      if (cb) cb(deposit)
    }
  }

  handleDepositUtxoEvents = async (
    events: TypedEvent<
      [
        BigNumber,
        BigNumber,
        BigNumber,
        string,
        BigNumber,
        BigNumber,
        BigNumber,
      ] & {
        spendingPubKey: BigNumber
        salt: BigNumber
        eth: BigNumber
        token: string
        amount: BigNumber
        nft: BigNumber
        fee: BigNumber
      }
    >[],
    account: ZkAddress,
    db: TransactionDB,
    cb?: (utxo: UtxoSql) => void,
  ) => {
    for (const event of [events].flat()) {
      const { args, blockNumber, transactionHash } = event
      const tx = await this.provider.getTransaction(transactionHash)
      const salt = Fp.from(args.salt.toString())
      const note = new Note(account, salt, {
        eth: Fp.from(args.eth.toString()),
        tokenAddr: Fp.from(Address.from(args.token).toBigNumber()),
        erc20Amount: Fp.from(args.amount.toString()),
        nft: Fp.from(args.nft.toString()),
      })
      const utxo: UtxoSql = {
        hash: note
          .hash()
          .toUint256()
          .toString(),
        eth: note
          .eth()
          .toUint256()
          .toString(),
        owner: account.toString(),
        salt: note.salt.toUint256().toString(),
        tokenAddr: note
          .tokenAddr()
          .toHexString()
          .toString(),
        erc20Amount: note
          .erc20Amount()
          .toUint256()
          .toString(),
        nft: note
          .nft()
          .toUint256()
          .toString(),
        depositedAt: blockNumber,
      }
      logger.info(`core/event-processor - Discovered my deposit (${utxo.hash})`)
      db.upsert('Utxo', {
        where: { hash: utxo.hash },
        update: utxo,
        create: utxo,
      })
      db.update('Deposit', {
        where: {
          note: note
            .hash()
            .toUint256()
            .toString(),
        },
        update: {
          from: tx.from,
          ownerAddress: account.toString(),
        },
      })
      if (cb) cb(utxo)
    }
  }

  handleMassDepositCommitEvents = (
    events: TypedEvent<
      [BigNumber, string, BigNumber] & {
        index: BigNumber
        merged: string
        fee: BigNumber
      }
    >[],
    db: TransactionDB,
    cb?: (commit: MassDepositSql) => void,
  ) => {
    if (Array.isArray(events)) {
      logger.info(
        `core/event-processor - Ingesting ${events.length} MassDepositCommit events`,
      )
    }
    for (const event of [events].flat()) {
      const { args, blockNumber } = event
      const massDeposit: MassDepositSql = {
        index: args.index.toString(),
        merged: Bytes32.from(args.merged).toString(),
        fee: args.fee.toString(),
        blockNumber,
        includedIn: null,
      }
      db.upsert('MassDeposit', {
        where: { index: massDeposit.index },
        create: massDeposit,
        update: {},
      })
      if (cb) cb(massDeposit)
    }
  }

  handleNewProposalEvents = (
    events: TypedEvent<
      [BigNumber, string] & {
        proposalNum: BigNumber
        blockHash: string
      }
    >[],
    db: TransactionDB,
    cb?: (hash: string) => void,
  ) => {
    if (Array.isArray(events)) {
      logger.info(`core/event-processor - ${events.length} new Proposals`)
    }
    for (const event of [events].flat()) {
      const { args, blockNumber, transactionHash } = event
      // WRITE DATABASE
      const { proposalNum, blockHash } = args
      const newProposal = {
        hash: Bytes32.from(blockHash).toString(),
        proposalNum: proposalNum.toNumber(),
        proposedAt: blockNumber,
        proposalTx: transactionHash,
      }
      db.upsert('Proposal', {
        where: { hash: newProposal.hash },
        create: newProposal,
        update: newProposal,
      })
      if (cb) cb(blockHash)
    }
  }

  handleSlashEvent = async (
    events: TypedEvent<
      [string, string, string] & {
        blockHash: string
        proposer: string
        reason: string
      }
    >[],
    db: TransactionDB,
    cb?: (hash: string) => void,
  ) => {
    for (const event of [events].flat()) {
      const { args, blockNumber, transactionHash } = event
      const hash = Bytes32.from(args.blockHash).toString()
      const proposer = Address.from(args.proposer).toString()
      const { reason } = args
      logger.info(
        `core/event-processor - Slash: ${proposer} proposed invalid block ${hash}(${reason}).`,
      )
      db.upsert('Slash', {
        where: { hash },
        create: {
          proposer,
          reason,
          executionTx: transactionHash,
          slashedAt: blockNumber,
          hash,
        },
        update: {
          hash,
          proposer,
          reason,
          executionTx: transactionHash,
          slashedAt: blockNumber,
        },
      })
      db.update('Tx', {
        where: { blockHash: hash },
        update: { slashed: true },
      })
      if (cb) cb(hash)
    }
  }

  handleFinalizationEvents = (
    events: TypedEvent<[string] & { blockHash: string }>[],
    db: TransactionDB,
    cb?: (hash: string) => void,
  ) => {
    logger.info(`core/event-processor - Finalized ${events.length} blocks`)
    for (const event of [events].flat()) {
      const { blockHash } = event.args
      const hash = Bytes32.from(blockHash).toString()
      db.upsert('Proposal', {
        where: { hash },
        create: { hash, finalized: true },
        update: { finalized: true },
      })
      if (cb) cb(blockHash)
    }
  }

  handleNewErc20Events = (
    events: TypedEvent<
      [string] & {
        tokenAddr: string
      }
    >[],
    db: TransactionDB,
  ) => {
    for (const event of [events].flat()) {
      const { args, blockNumber } = event
      // WRITE DATABASE
      const { tokenAddr } = args
      logger.info(`core/event-processor - ERC20 token registered: ${tokenAddr}`)
      const tokenRegistry: TokenRegistrySql = {
        address: tokenAddr,
        isERC20: true,
        isERC721: false,
        identifier: Address.from(tokenAddr)
          .toBigNumber()
          .mod(256)
          .toNumber(),
        blockNumber,
      }

      db.upsert('TokenRegistry', {
        where: { address: tokenAddr },
        create: tokenRegistry,
        update: tokenRegistry,
      })
    }
  }

  handleNewErc721Events = async (
    events: TypedEvent<
      [string] & {
        tokenAddr: string
      }
    >[],
    db: TransactionDB,
  ) => {
    for (const event of [events].flat()) {
      const { args, blockNumber } = event
      // WRITE DATABASE
      const { tokenAddr } = args
      logger.info(
        `core/event-processor - ERC721 token registered: ${tokenAddr}`,
      )
      const tokenRegistry: TokenRegistrySql = {
        address: tokenAddr,
        isERC20: false,
        isERC721: true,
        identifier: Address.from(tokenAddr)
          .toBigNumber()
          .mod(256)
          .toNumber(),
        blockNumber,
      }
      db.upsert('TokenRegistry', {
        where: { address: tokenAddr },
        create: tokenRegistry,
        update: tokenRegistry,
      })
    }
  }
}
