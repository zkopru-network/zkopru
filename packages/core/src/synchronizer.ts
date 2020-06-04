import { InanoSQLInstance } from '@nano-sql/core'
import {
  schema,
  DepositSql,
  MassDepositCommitSql,
  BlockStatus,
  HeaderSql,
} from '@zkopru/database'
import { logger } from '@zkopru/utils'
import { EventEmitter } from 'events'
import { InanoSQLObserverQuery } from '@nano-sql/core/lib/interfaces'
import { toBN } from 'web3-utils'
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
  zkopruId: string

  db: InanoSQLInstance

  l1Contract!: L1Contract

  fetching: {
    [proposalTx: string]: boolean
  }

  depositSubscriber?: EventEmitter

  massDepositCommitSubscriber?: EventEmitter

  proposalSubscriber?: EventEmitter

  finalizationSubscriber?: EventEmitter

  private latestProposalObserver?: InanoSQLObserverQuery

  private latestProcessedObserver?: InanoSQLObserverQuery

  private latestProposedHash?: string

  private latestProposed?: number

  private latestProcessed?: number

  private cronJob?: Job

  status: NetworkStatus

  constructor(db: InanoSQLInstance, zkopruId: string, l1Contract: L1Contract) {
    super()
    this.db = db
    this.zkopruId = zkopruId
    this.l1Contract = l1Contract
    this.fetching = {}
    this.status = NetworkStatus.STOPPED
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
      this.listenBlockUpdate()
      this.listenDeposits()
      this.listenMassDepositCommit()
      this.listenNewProposals(proposalCB)
      this.listenFinalization(finalizationCB)
    }
    this.cronJob = scheduleJob('*/5 * * * * *', () => {
      this.updateStatus()
      this.checkUnfetched()
    })
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
    if (this.latestProposalObserver) {
      this.latestProposalObserver.unsubscribe()
    }
    if (this.cronJob) {
      this.cronJob.cancel()
      this.cronJob = undefined
    }
    this.setStatus(NetworkStatus.STOPPED)
  }

  listenBlockUpdate() {
    this.latestProposalObserver = this.db
      .selectTable(schema.block.name)
      .query('select', ['hash', 'MAX(proposalNum)'])
      .listen({
        debounce: 500,
        unique: false,
        compareFn: (rowsA, rowsB) => {
          console.log('new block on comparing')
          console.log('rows a', rowsA)
          console.log('rows b', rowsB)
          return rowsA[0]?.proposalNum !== rowsB[0]?.proposalNum
        },
      })
    this.latestProposalObserver.exec(async (rows, err) => {
      if (err) this.setStatus(NetworkStatus.ON_ERROR)
      else {
        this.latestProposedHash = rows[0]?.hash
        this.setLatestProposed(rows[0]?.proposalNum)
      }
    })
    this.latestProcessedObserver = this.db
      .selectTable(schema.block.name)
      .presetQuery('getLastProcessedBlock')
      .listen({
        debounce: 500,
        unique: false,
        compareFn: (rowsA, rowsB) => {
          return rowsA[0]?.proposalNum !== rowsB[0]?.proposalNum
        },
      })
    this.latestProcessedObserver.exec(async (rows, err) => {
      if (err) this.setStatus(NetworkStatus.ON_ERROR)
      else {
        this.setLatestProcessed(rows[0]?.proposalNum)
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
    const queryResult = await this.db
      .selectTable(schema.block.name)
      .query('select', ['MAX(proposalNum) AS knownBlocks'])
      .exec()
    const lastProcessedBlock = (
      await this.db
        .selectTable(schema.block.name)
        .presetQuery('getLastProcessedBlock')
        .exec()
    )[0]
    const totalProposed = await this.l1Contract.upstream.methods
      .proposedBlocks()
      .call()
    const knownBlocks = queryResult[0]?.knownBlocks + 1 || 0
    const processedBlocks = lastProcessedBlock?.proposalNum + 1 || 0
    logger.info(
      `proposed: ${totalProposed} / known: ${knownBlocks} / processed: ${processedBlocks}`,
    )
    const haveFetchedAll = toBN(totalProposed).eqn(knownBlocks)
    const haveProcessedAll = toBN(processedBlocks).eqn(knownBlocks)
    if (!haveFetchedAll) {
      this.setStatus(NetworkStatus.ON_SYNCING)
    } else if (!haveProcessedAll) {
      this.setStatus(NetworkStatus.ON_PROCESSING)
    } else {
      this.setStatus(NetworkStatus.SYNCED)
    }
  }

  async checkUnfetched() {
    const MAX_FETCH_JOB = 10
    const availableFetchJob = Math.max(
      MAX_FETCH_JOB - Object.keys(this.fetching).length,
      0,
    )
    if (availableFetchJob === 0) return
    const candidates = await this.db
      .selectTable(schema.block.name)
      .query('select', ['proposalTx'])
      .where(['status', '=', BlockStatus.NOT_FETCHED])
      .orderBy(['proposalNum ASC'])
      .limit(availableFetchJob)
      .exec()
    console.log('fetch candidates: ', candidates)
    console.log(
      'hhhmm',
      await this.db
        .selectTable(schema.block.name)
        .query('select')
        .exec(),
    )
    candidates.forEach(candidate => this.fetch(candidate.proposalTx))
  }

  async listenGenesis() {
    const query = await this.db
      .selectTable(schema.block.name)
      .query('select')
      .where(['proposalNum', '=', 0])
      .exec()
    const genesisExist = query.length === 1
    if (!genesisExist) {
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
          console.log(genesisHeader)
          const header: HeaderSql = {} as HeaderSql
          Object.keys(genesisHeader).forEach(key => {
            header[key] = genesisHeader[key].toString()
          })
          if (!Bytes32.from(blockHash).eq(headerHash(genesisHeader))) {
            throw Error('Failed to set up the genesis block')
          }
          await this.db
            .selectTable(schema.block.name)
            .presetQuery('addGenesisBlock', {
              hash: Bytes32.from(blockHash).toString(),
              header,
              proposedAt: blockNumber,
              proposalTx: transactionHash,
            })
            .exec()
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
    const query = await this.db
      .selectTable(schema.deposit.name)
      .presetQuery('getSyncStart', { zkopru: this.zkopruId })
      .exec()
    const fromBlock = query[0]?.proposedAt || 0
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
          zkopru: this.zkopruId,
          transactionIndex,
          logIndex,
          blockNumber,
        }
        logger.info(`synchronizer.js: NewDeposit(${deposit.note})`)
        console.log('deposit detail', deposit)
        await this.db
          .selectTable(schema.deposit.name)
          .presetQuery('writeNewDeposit', { deposit })
          .exec()
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

  async listenMassDepositCommit(cb?: (commit: MassDepositCommitSql) => void) {
    const query = await this.db
      .selectTable(schema.massDeposit.name)
      .presetQuery('getSyncStart', { zkopru: this.zkopruId })
      .exec()
    const fromBlock = query[0]?.proposedAt || 0
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
        const massDeposit: MassDepositCommitSql = {
          index: Uint256.from(returnValues.index).toString(),
          merged: Bytes32.from(returnValues.merged).toString(),
          fee: Uint256.from(returnValues.fee).toString(),
          zkopru: this.zkopruId,
          blockNumber,
        }
        console.log('massdeposit commit is', massDeposit)
        await this.db
          .selectTable(schema.massDeposit.name)
          .presetQuery('writeMassDepositCommit', { massDeposit })
          .exec()
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
    const query = await this.db
      .selectTable(schema.block.name)
      .presetQuery('getProposalSyncStart')
      .exec()
    const fromBlock = query[0]?.proposedAt || 0
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
          blockHash: Bytes32.from(blockHash).toString(),
          proposalNum: parseInt(proposalNum, 10),
          proposedAt: blockNumber,
          proposalTx: transactionHash,
        }
        console.log('newProposal', newProposal)
        await this.db
          .selectTable(schema.block.name)
          .presetQuery('writeNewProposal', newProposal)
          .exec()
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
    const query = await this.db
      .selectTable(schema.block.name)
      .presetQuery('getFinalizationSyncStart')
      .exec()
    const startFrom = query[0]?.proposedAt || 0
    this.finalizationSubscriber = this.l1Contract.coordinator.events
      .Finalized({ fromBlock: startFrom })
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
    const header: HeaderSql = {} as HeaderSql
    Object.keys(block.header).forEach(key => {
      header[key] = block.header[key].toString()
    })
    const { hash } = block
    await this.db
      .selectTable(schema.block.name)
      .presetQuery('saveFetchedBlock', {
        hash: hash.toString(),
        header,
        proposalData,
      })
      .exec()
    delete this.fetching[proposalTx]
    this.emit('newBlock', block)
  }
}
