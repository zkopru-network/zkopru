/* eslint-disable @typescript-eslint/camelcase */
import { logger } from '@zkopru/utils'
import {
  DB,
  Config,
  Header as HeaderSql,
  Deposit as DepositSql,
  MassDeposit as MassDepositSql,
} from '@zkopru/prisma'
import { EventEmitter } from 'events'
import { scheduleJob, Job } from 'node-schedule'
import { Bytes32, Address, Uint256 } from 'soltypes'
import { L1Contract } from './layer1'
import { Block, headerHash } from './block'
import { genesis } from './genesis'

export enum NetworkStatus {
  STOPPED = 'stopped',
  ON_SYNCING = 'on syncing',
  ON_PROCESSING = 'processing',
  SYNCED = 'synced',
  ON_ERROR = 'on error',
}

export class Synchronizer extends EventEmitter {
  config: Config

  db: DB

  l1Contract!: L1Contract

  fetching: {
    [proposalTx: string]: boolean
  }

  depositSubscriber?: EventEmitter

  massDepositCommitSubscriber?: EventEmitter

  proposalSubscriber?: EventEmitter

  finalizationSubscriber?: EventEmitter

  private latestProposedHash?: string

  private latestProposed?: number

  private latestProcessed?: number

  private cronJobs: Job[]

  status: NetworkStatus

  constructor(db: DB, config: Config, l1Contract: L1Contract) {
    super()
    this.db = db
    this.config = config
    this.l1Contract = l1Contract
    this.fetching = {}
    this.status = NetworkStatus.STOPPED
    this.cronJobs = []
  }

  setStatus(status: NetworkStatus) {
    if (this.status !== status) {
      this.status = status
      this.emit('status', status, this.latestProposedHash)
      logger.info(`sync status: ${status}`)
    }
  }

  sync(
    proposalCB?: (hash: string) => void,
    finalizationCB?: (hash: string) => void,
  ) {
    if (this.status === NetworkStatus.STOPPED) {
      this.setStatus(NetworkStatus.ON_SYNCING)
      this.listenGenesis()
      this.listenDeposits()
      this.listenMassDepositCommit()
      this.listenNewProposals(proposalCB)
      this.listenFinalization(finalizationCB)
    }
    this.cronJobs = [
      scheduleJob('*/5 * * * * *', () => {
        this.updateStatus()
        this.fetchUnfetchedProposals()
      }),
      scheduleJob('*/1 * * * * *', () => {
        this.checkBlockUpdate()
      }),
    ]
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
    while (this.cronJobs.length > 0) {
      ;(this.cronJobs.pop() as Job).cancel()
    }
    this.setStatus(NetworkStatus.STOPPED)
  }

  checkBlockUpdate() {
    this.db.prisma.proposal
      .findMany({
        orderBy: {
          proposalNum: 'desc',
        },
        take: 1,
      })
      .then(proposals => {
        if (proposals[0]?.proposalNum) {
          this.setLatestProposed(proposals[0]?.proposalNum)
        }
      })
    this.db.prisma.proposal
      .findMany({
        where: {
          block: {
            verified: true,
          },
        },
        orderBy: {
          proposalNum: 'desc',
        },
        take: 1,
      })
      .then(proposals => {
        if (proposals[0]?.proposalNum) {
          this.setLatestProcessed(proposals[0]?.proposalNum)
        }
      })
  }

  private setLatestProposed(proposalNum: number) {
    if (proposalNum && this.latestProposed !== proposalNum) {
      this.latestProposed = proposalNum
    }
  }

  private setLatestProcessed(proposalNum: number) {
    if (proposalNum && this.latestProcessed !== proposalNum) {
      this.latestProcessed = proposalNum
    }
  }

  async updateStatus() {
    const knownBlocks = this.latestProposed
    const processedBlocks = this.latestProcessed
    const unfetched = await this.db.prisma.proposal.count({
      where: {
        proposalData: {
          not: null,
        },
      },
    })
    const haveFetchedAll = unfetched > 0
    const haveProcessedAll = processedBlocks === knownBlocks
    if (!haveFetchedAll) {
      this.setStatus(NetworkStatus.ON_SYNCING)
    } else if (!haveProcessedAll) {
      this.setStatus(NetworkStatus.ON_PROCESSING)
    } else {
      this.setStatus(NetworkStatus.SYNCED)
    }
  }

  async fetchUnfetchedProposals() {
    const MAX_FETCH_JOB = 10
    const availableFetchJob = Math.max(
      MAX_FETCH_JOB - Object.keys(this.fetching).length,
      0,
    )
    if (availableFetchJob === 0) return
    const candidates = await this.db.prisma.proposal.findMany({
      where: {
        proposalData: {
          not: null,
        },
      },
      orderBy: {
        proposalNum: 'asc',
      },
      take: availableFetchJob,
    })
    candidates.forEach(candidate => {
      this.fetch(candidate.proposalTx)
    })
  }

  async listenGenesis() {
    const numOfGenesisBlock = await this.db.prisma.proposal.count({
      where: { proposalNum: 0 },
    })
    if (numOfGenesisBlock === 0) {
      logger.info('No genesis block. Trying to fetch')
      const genesisListener = this.l1Contract.upstream.events
        .GenesisBlock({ fromBlock: 0 })
        .on('data', async event => {
          const { returnValues, blockNumber, transactionHash } = event
          // WRITE DATABASE
          const { blockHash, proposer, parentBlock } = returnValues
          console.log('genesis hash: ', blockHash)
          console.log('genesis data: ', returnValues)

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
          await this.db.prisma.proposal.create({
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
          })
          genesisListener.removeAllListeners()
          if (!this.latestProposed) {
            this.setLatestProposed(0)
          }
          if (!this.latestProcessed) {
            this.setLatestProcessed(0)
          }
        })
    }
  }

  async listenDeposits(cb?: (deposit: DepositSql) => void) {
    const lastDeposits = await this.db.prisma.deposit.findMany({
      orderBy: { blockNumber: 'desc' },
      take: 1,
    })
    const fromBlock = lastDeposits[0]?.blockNumber || 0
    console.log('new deposit from block', fromBlock)
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
        console.log('deposit detail', deposit)
        await this.db.prisma.deposit.upsert({
          where: { note: deposit.note },
          update: deposit,
          create: deposit,
        })
        if (cb) cb(deposit)
        console.log('deposit succeeded')
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
    const lastMassDeposit = await this.db.prisma.massDeposit.findMany({
      orderBy: { blockNumber: 'desc' },
      take: 1,
    })
    const fromBlock = lastMassDeposit[0]?.blockNumber || 0
    console.log('mass deposit from block', fromBlock)
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
          `MassDepositCommit ${(returnValues.index,
          returnValues.merged,
          returnValues.fee)}`,
        )
        const massDeposit = {
          index: Uint256.from(returnValues.index).toString(),
          merged: Bytes32.from(returnValues.merged).toString(),
          fee: Uint256.from(returnValues.fee).toString(),
          zkopruId: this.config.id,
          blockNumber,
          includedIn: null,
        }
        console.log('massdeposit commit is', massDeposit)
        await this.db.prisma.massDeposit.upsert({
          where: {
            index: massDeposit.index,
          },
          create: massDeposit,
          update: {},
        })
        if (cb) cb(massDeposit)
        console.log('massdeposit commit succeeded')
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
    const lastProposal = await this.db.prisma.proposal.findMany({
      orderBy: { proposedAt: 'desc' },
      take: 1,
    })
    const fromBlock = lastProposal[0]?.proposedAt || 0
    console.log('listenNewProposal fromBlock: ', fromBlock)
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
        console.log('newProposal: ', returnValues)
        console.log('blocknumber: ', blockNumber)
        console.log('transactionHash: ', transactionHash)
        const newProposal = {
          hash: Bytes32.from(blockHash).toString(),
          proposalNum: parseInt(proposalNum, 10),
          proposedAt: blockNumber,
          proposalTx: transactionHash,
        }
        console.log('newProposal', newProposal)
        await this.db.prisma.proposal.upsert({
          where: {
            hash: newProposal.hash,
          },
          create: newProposal,
          update: newProposal,
        })
        if (cb) cb(blockHash)
        // FETCH DETAILS
        this.fetch(transactionHash)
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
    if (this.status !== NetworkStatus.STOPPED) return

    const lastFinalized = await this.db.prisma.proposal.findMany({
      where: { finalized: true },
      orderBy: { proposedAt: 'desc' },
      take: 1,
    })
    const fromBlock = lastFinalized[0]?.proposedAt || 0
    this.finalizationSubscriber = this.l1Contract.coordinator.events
      .Finalized({ fromBlock })
      .on('connected', subId => {
        logger.info(
          `synchronizer.js: Finalization listner is connected. Id: ${subId}`,
        )
      })
      .on('data', async event => {
        const { returnValues } = event
        this.emit('finalization', returnValues)
        if (cb) cb(returnValues)
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

  async fetch(proposalTx: string) {
    logger.info('fetched block proposal')
    if (this.fetching[proposalTx]) return
    const proposalData = await this.l1Contract.web3.eth.getTransaction(
      proposalTx,
    )
    const block = Block.fromTx(proposalData)
    const header = block.getHeaderSql()
    await this.db.prisma.proposal.update({
      where: {
        hash: header.hash,
      },
      data: {
        block: {
          create: {
            header: {
              create: header,
            },
          },
        },
        proposalData: JSON.stringify(proposalData),
      },
    })
    delete this.fetching[proposalTx]
    this.emit('newBlock', block)
  }
}
