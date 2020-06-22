/* eslint-disable @typescript-eslint/camelcase */
import { logger } from '@zkopru/utils'
import {
  DB,
  Header as HeaderSql,
  Deposit as DepositSql,
  MassDeposit as MassDepositSql,
} from '@zkopru/prisma'
import { EventEmitter } from 'events'
import { Bytes32, Address, Uint256 } from 'soltypes'
import { L1Contract } from './layer1'
import { headerHash } from './block'
import { genesis } from './genesis'

export class Synchronizer {
  db: DB

  l1Contract!: L1Contract

  depositSubscriber?: EventEmitter

  massDepositCommitSubscriber?: EventEmitter

  proposalSubscriber?: EventEmitter

  finalizationSubscriber?: EventEmitter

  isListening: boolean

  constructor(db: DB, l1Contract: L1Contract) {
    this.db = db
    this.l1Contract = l1Contract
    this.isListening = false
  }

  sync(
    proposalCB?: (hash: string) => void,
    finalizationCB?: (hash: string) => void,
  ) {
    if (!this.isListening) {
      this.listenGenesis()
      this.listenDeposits()
      this.listenMassDepositCommit()
      this.listenNewProposals(proposalCB)
      this.listenFinalization(finalizationCB)
      this.isListening = true
    }
  }

  stop() {
    if (this.proposalSubscriber) {
      this.proposalSubscriber.removeAllListeners()
    }
    if (this.depositSubscriber) {
      this.depositSubscriber.removeAllListeners()
    }
    if (this.massDepositCommitSubscriber) {
      this.massDepositCommitSubscriber.removeAllListeners()
    }
    if (this.finalizationSubscriber) {
      this.finalizationSubscriber.removeAllListeners()
    }
    this.isListening = false
  }

  async listenGenesis() {
    const numOfGenesisBlock = await this.db.read(prisma =>
      prisma.proposal.count({
        where: { proposalNum: 0 },
      }),
    )
    if (numOfGenesisBlock === 0) {
      logger.info('No genesis block. Trying to fetch')
      const genesisListener = this.l1Contract.upstream.events
        .GenesisBlock({ fromBlock: 0 })
        .on('data', async event => {
          const { returnValues, blockNumber, transactionHash } = event
          // WRITE DATABASE
          const { blockHash, proposer, parentBlock } = returnValues
          logger.info(`genesis hash: ${blockHash}`)
          logger.info(`genesis data: ${returnValues}`)

          // GENESIS BLOCK
          const config = await this.l1Contract.getConfig()
          const genesisHeader = genesis({
            address: Address.from(proposer),
            parent: Bytes32.from(parentBlock),
            config,
          })
          if (!Bytes32.from(blockHash).eq(headerHash(genesisHeader))) {
            throw Error('Failed to set up the genesis block')
          }
          const header: HeaderSql = {
            hash: blockHash,
            proposer: genesisHeader.proposer.toString(),
            parentBlock: genesisHeader.parentBlock.toString(),
            metadata: genesisHeader.metadata.toString(),
            fee: genesisHeader.fee.toString(),
            utxoRoot: genesisHeader.utxoRoot.toString(),
            utxoIndex: genesisHeader.utxoIndex.toString(),
            nullifierRoot: genesisHeader.nullifierRoot.toString(),
            withdrawalRoot: genesisHeader.withdrawalRoot.toString(),
            withdrawalIndex: genesisHeader.withdrawalIndex.toString(),
            txRoot: genesisHeader.txRoot.toString(),
            depositRoot: genesisHeader.depositRoot.toString(),
            migrationRoot: genesisHeader.migrationRoot.toString(),
          }

          await this.db.write(prisma =>
            prisma.proposal.create({
              data: {
                hash: blockHash,
                block: {
                  create: {
                    header: {
                      create: header,
                    },
                    verified: true,
                  },
                },
                proposalNum: 0,
                proposedAt: blockNumber,
                proposalTx: transactionHash,
                finalized: true,
                invalidated: false,
                proposalData: '',
              },
            }),
          )
          genesisListener.removeAllListeners()
        })
    }
  }

  async listenDeposits(cb?: (deposit: DepositSql) => void) {
    const lastDeposits = await this.db.read(prisma =>
      prisma.deposit.findMany({
        orderBy: { blockNumber: 'desc' },
        take: 1,
      }),
    )
    const fromBlock = lastDeposits[0]?.blockNumber || 0
    logger.info('new deposit from block', fromBlock)
    this.depositSubscriber = this.l1Contract.user.events
      .Deposit({ fromBlock })
      .on('connected', subId => {
        logger.info(
          `synchronizer.js: Deposit listner is connected. Id: ${subId}`,
        )
      })
      .on('data', async event => {
        const { returnValues, logIndex, transactionIndex, blockNumber } = event
        const deposit: DepositSql = {
          note: Uint256.from(returnValues.note).toString(),
          fee: Uint256.from(returnValues.fee).toString(),
          queuedAt: Uint256.from(returnValues.queuedAt).toString(),
          transactionIndex,
          logIndex,
          blockNumber,
        }
        logger.info(`synchronizer.js: NewDeposit(${deposit.note})`)
        await this.db.write(prisma =>
          prisma.deposit.upsert({
            where: { note: deposit.note },
            update: deposit,
            create: deposit,
          }),
        )
        if (cb) cb(deposit)
      })
      .on('changed', event => {
        // TODO
        logger.info(`synchronizer.js: Deposit Event changed`, event)
      })
      .on('error', event => {
        // TODO
        logger.info(`synchronizer.js: Deposit Event Error occured`, event)
      })
  }

  async listenMassDepositCommit(cb?: (commit: MassDepositSql) => void) {
    const lastMassDeposit = await this.db.read(prisma =>
      prisma.massDeposit.findMany({
        orderBy: { blockNumber: 'desc' },
        take: 1,
      }),
    )
    const fromBlock = lastMassDeposit[0]?.blockNumber || 0
    logger.info('sync mass deposits from block', fromBlock)
    this.massDepositCommitSubscriber = this.l1Contract.coordinator.events
      .MassDepositCommit({ fromBlock })
      .on('connected', subId => {
        logger.info(
          `synchronizer.js: MassDepositCommit listner is connected. Id: ${subId}`,
        )
      })
      .on('data', async event => {
        const { returnValues, blockNumber } = event
        logger.info(
          `MassDepositCommit
          ${returnValues.index}
          ${returnValues.merged}
          ${returnValues.fee}`,
        )
        const massDeposit: MassDepositSql = {
          index: Uint256.from(returnValues.index).toString(),
          merged: Bytes32.from(returnValues.merged).toString(),
          fee: Uint256.from(returnValues.fee).toString(),
          blockNumber,
          includedIn: null,
        }
        logger.debug(
          `Massdeposit: index ${massDeposit.index} / merged: ${massDeposit.merged} / fee: ${massDeposit.fee}`,
        )
        logger.info('massdeposit commit is', massDeposit)
        await this.db.write(prisma =>
          prisma.massDeposit.upsert({
            where: {
              index: massDeposit.index,
            },
            create: massDeposit,
            update: {},
          }),
        )
        if (cb) cb(massDeposit)
        logger.info('massdeposit commit succeeded')
      })
      .on('changed', event => {
        // TODO
        logger.info(`synchronizer.js: MassDeposit Event changed`, event)
      })
      .on('error', event => {
        // TODO
        logger.info(`synchronizer.js: MassDeposit Event error changed`, event)
      })
  }

  async listenNewProposals(cb?: (hash: string) => void) {
    const lastProposal = await this.db.read(prisma =>
      prisma.proposal.findMany({
        orderBy: { proposedAt: 'desc' },
        take: 1,
      }),
    )
    const fromBlock = lastProposal[0]?.proposedAt || 0
    logger.info('listenNewProposal fromBlock: ', fromBlock)
    this.proposalSubscriber = this.l1Contract.coordinator.events
      .NewProposal({ fromBlock })
      .on('connected', subId => {
        logger.info(
          `synchronizer.js: NewProposal listner is connected. Id: ${subId}`,
        )
      })
      .on('data', async event => {
        const { returnValues, blockNumber, transactionHash } = event
        // WRITE DATABASE
        const { proposalNum, blockHash } = returnValues
        logger.info(`newProposal: ${returnValues}`)
        logger.info(`blocknumber: ${blockNumber}`)
        logger.info(`transactionHash: ${transactionHash}`)
        const newProposal = {
          hash: Bytes32.from(blockHash).toString(),
          proposalNum: parseInt(proposalNum, 10),
          proposedAt: blockNumber,
          proposalTx: transactionHash,
        }
        logger.info(`newProposal ${newProposal}`)
        await this.db.write(prisma =>
          prisma.proposal.upsert({
            where: {
              hash: newProposal.hash,
            },
            create: newProposal,
            update: newProposal,
          }),
        )
        if (cb) cb(blockHash)
      })
      .on('changed', event => {
        // TODO
        logger.info(`synchronizer.js: NewProposal Event changed`, event)
      })
      .on('error', err => {
        // TODO
        logger.info(`synchronizer.js: NewProposal Event error occured`, err)
      })
  }

  async listenFinalization(cb?: (hash: string) => void) {
    const lastFinalized = await this.db.read(prisma =>
      prisma.proposal.findMany({
        where: { finalized: true },
        orderBy: { proposedAt: 'desc' },
        take: 1,
      }),
    )
    const fromBlock = lastFinalized[0]?.proposedAt || 0
    this.finalizationSubscriber = this.l1Contract.coordinator.events
      .Finalized({ fromBlock })
      .on('connected', subId => {
        logger.info(
          `synchronizer.js: Finalization listner is connected. Id: ${subId}`,
        )
      })
      .on('data', async event => {
        let blockHash: string
        if (typeof event.returnValues === 'string')
          blockHash = event.returnValues
        else blockHash = (event.returnValues as any).blockHash
        const hash = Bytes32.from(blockHash).toString()
        logger.debug(`finalization hash@!${hash}`)
        logger.debug(`${JSON.stringify(event.returnValues)}`)
        await this.db.write(prisma =>
          prisma.proposal.upsert({
            where: { hash },
            create: { hash, finalized: true },
            update: { finalized: true },
          }),
        )
        if (cb) cb(blockHash)
      })
      .on('changed', event => {
        // TODO removed
        logger.info(`synchronizer.js: Finalization Event changed`, event)
      })
      .on('error', err => {
        // TODO removed
        logger.info(`synchronizer.js: Finalization Event error occured`, err)
      })
  }
}
