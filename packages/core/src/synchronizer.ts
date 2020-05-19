import { InanoSQLInstance } from '@nano-sql/core'
import { schema, DepositSql, MassDepositCommitSql } from '@zkopru/database'
import { logger } from '@zkopru/utils'
import { EventEmitter } from 'events'
import { InanoSQLObserverQuery } from '@nano-sql/core/lib/interfaces'
import { L1Contract } from './layer1'
import { Block } from './block'

export enum NetworkStatus {
  STOPPED,
  INITIALIZING,
  ON_SYNCING,
  LIVE,
  FULLY_SYNCED,
  ON_ERROR,
}

export class Synchronizer extends EventEmitter {
  zkopruId: string

  db: InanoSQLInstance

  l1Contract!: L1Contract

  fetching: {
    [proposalHash: string]: boolean
  }

  depositSubscriber?: EventEmitter

  massDepositCommitSubscriber?: EventEmitter

  proposalSubscriber?: EventEmitter

  finalizationSubscriber?: EventEmitter

  private latestProposalObserver?: InanoSQLObserverQuery

  private latestVerificationObserver?: InanoSQLObserverQuery

  private latestProposedHash?: string

  private latestProposedAt?: number

  private latestVerfied?: number

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
    }
  }

  async sync(
    proposalCB?: (hash: string) => void,
    finalizationCB?: (hash: string) => void,
  ) {
    if (this.status === NetworkStatus.STOPPED) {
      this.setStatus(NetworkStatus.ON_SYNCING)
      this.listenBlockUpdate()
      this.listenDeposits()
      this.listenMassDepositCommit()
      this.listenNewProposals(proposalCB)
      this.listenFinalization(finalizationCB)
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
    if (this.latestProposalObserver) {
      this.latestProposalObserver.unsubscribe()
    }
    this.setStatus(NetworkStatus.STOPPED)
  }

  listenBlockUpdate() {
    this.latestProposalObserver = this.db
      .selectTable(schema.block.name)
      .query('select', ['hash', 'MAX(proposedAt)'])
      .listen({
        debounce: 500,
        compareFn: (rowsA, rowsB) => {
          return rowsA[0]?.proposedAt !== rowsB[0]?.proposedAt
        },
      })
    this.latestProposalObserver.exec(async (rows, err) => {
      if (err) this.setStatus(NetworkStatus.ON_ERROR)
      else {
        this.latestProposedHash = rows[0]?.hash
        this.setLatestProposed(rows[0]?.proposesAt)
      }
    })
    this.latestVerificationObserver = this.db
      .selectTable(schema.block.name)
      .presetQuery('getLastVerifiedBlock')
      .listen({
        debounce: 500,
        compareFn: (rowsA, rowsB) => {
          return rowsA[0]?.proposedAt !== rowsB[0]?.proposedAt
        },
      })
    this.latestVerificationObserver.exec(async (rows, err) => {
      if (err) this.setStatus(NetworkStatus.ON_ERROR)
      else {
        this.setLatestVerified(rows[0]?.proposesAt)
      }
    })
  }

  private setLatestProposed(blockNum: number) {
    if (this.latestProposedAt !== blockNum) {
      this.latestProposedAt = blockNum
      this.updateStatus()
    }
  }

  private setLatestVerified(blockNum: number) {
    if (this.latestVerfied !== blockNum) {
      this.latestVerfied = blockNum
      this.updateStatus()
    }
  }

  async updateStatus() {
    if (!this.latestProposedAt || !this.latestVerfied) {
      this.setStatus(NetworkStatus.INITIALIZING)
    } else if (this.latestProposedAt === this.latestVerfied) {
      this.setStatus(NetworkStatus.FULLY_SYNCED)
    } else if (this.latestProposedAt - this.latestVerfied < 5) {
      this.setStatus(NetworkStatus.LIVE)
    } else {
      this.setStatus(NetworkStatus.ON_SYNCING)
    }
    // TODO: layer1 REVERT handling & challenge handling
  }

  async listenDeposits(cb?: (deposit: DepositSql) => void) {
    const query = await this.db
      .selectTable(schema.deposit.name)
      .presetQuery('getSyncStart', { zkopru: this.zkopruId })
      .exec()
    const fromBlock = query[0] ? query[0].proposedAt : 0
    this.depositSubscriber = this.l1Contract.user.events
      .Deposit({ fromBlock })
      .on('connected', subId => {
        logger.info(
          `synchronizer.js: Deposit listner is connected. Id: ${subId}`,
        )
      })
      .on('data', async event => {
        const { returnValues, blockNumber } = event
        const deposit: DepositSql = {
          ...returnValues,
          zkopru: this.zkopruId,
          blockNumber,
        }
        await this.db
          .selectTable(schema.deposit.name)
          .presetQuery('writeNewDeposit', { deposit })
          .exec()
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

  async listenMassDepositCommit(cb?: (commit: MassDepositCommitSql) => void) {
    const query = await this.db
      .selectTable(schema.massDeposit.name)
      .presetQuery('getSyncStart', { zkopru: this.zkopruId })
      .exec()
    const fromBlock = query[0] ? query[0].proposedAt : 0
    this.massDepositCommitSubscriber = this.l1Contract.coordinator.events
      .MassDepositCommit({ fromBlock })
      .on('connected', subId => {
        logger.info(
          `synchronizer.js: MassDepositCommit listner is connected. Id: ${subId}`,
        )
      })
      .on('data', async event => {
        const { returnValues, blockNumber } = event
        const massDeposit: MassDepositCommitSql = {
          ...returnValues,
          zkopru: this.zkopruId,
          blockNumber,
        }
        await this.db
          .selectTable(schema.deposit.name)
          .presetQuery('writeMassDepositCommit', { massDeposit })
          .exec()
        if (cb) cb(massDeposit)
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
    if (this.status !== NetworkStatus.STOPPED) return
    const query = await this.db
      .selectTable(schema.block.name)
      .presetQuery('getProposalSyncStart')
      .exec()
    const fromBlock = query[0] ? query[0].proposedAt : 0
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
        await this.db
          .selectTable(schema.block.name)
          .presetQuery('writeNewProposal', {
            hash: returnValues,
            proposedAt: blockNumber,
            proposalHash: transactionHash,
          })
          .exec()
        if (cb) cb(returnValues)
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
    const startFrom = query[0] ? query[0].proposedAt : 0
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

  async fetch(proposalHash: string) {
    if (this.fetching[proposalHash]) return
    const proposalData = await this.l1Contract.web3.eth.getTransaction(
      proposalHash,
    )
    const block = Block.fromTx(proposalData)
    const { hash } = block
    await this.db
      .selectTable(schema.block.name)
      .presetQuery('saveFetchedBlock', {
        hash,
        header: block.header,
        proposalData,
      })
      .exec()
    delete this.fetching[proposalHash]
    this.emit('newBlock', block)
  }
}
