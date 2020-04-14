import { InanoSQLInstance } from '@nano-sql/core'
import { schema } from '@zkopru/database'
import { EventEmitter } from 'events'
import { InanoSQLObserverQuery } from '@nano-sql/core/lib/interfaces'
import { L1Contract } from './layer1'
import { deserializeBlockFromL1Tx } from './block'
import { L2Chain } from './layer2'

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

  l2Chain!: L2Chain

  fetching: {
    [proposalHash: string]: boolean
  }

  proposalSubscriber?: EventEmitter

  finalizationSubscriber?: EventEmitter

  private latestProposalObserver?: InanoSQLObserverQuery

  private latestVerificationObserver?: InanoSQLObserverQuery

  private latestProposedHash?: string

  private latestProposedAt?: number

  private latestVerfied?: number

  status: NetworkStatus

  constructor(db: InanoSQLInstance, l1Contract: L1Contract, l2Chain: L2Chain) {
    super()
    this.db = db
    this.zkopruId = l2Chain.id
    this.l1Contract = l1Contract
    this.l2Chain = l2Chain
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
      this.listenNewProposals(proposalCB)
      this.listenFinalization(finalizationCB)
    }
  }

  stop() {
    if (this.proposalSubscriber) {
      this.proposalSubscriber.removeAllListeners()
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
      .selectTable(schema.block(this.zkopruId).name)
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
      .selectTable(schema.block(this.zkopruId).name)
      .presetQuery('getLastVerfiedBlock')
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

  async listenNewProposals(cb?: (hash: string) => void) {
    if (this.status !== NetworkStatus.STOPPED) return
    const query = await this.db
      .selectTable(schema.block(this.zkopruId).name)
      .presetQuery('getProposalSyncIndex')
      .exec()
    const startFrom = query[0] ? query[0].proposedAt : 0
    this.proposalSubscriber = this.l1Contract.coordinator.events
      .NewProposal({ fromBlock: startFrom })
      .on('connected', subId => {
        console.log(subId)
      })
      .on('data', async event => {
        const { returnValues, blockNumber, transactionHash } = event
        // WRITE DATABASE
        await this.db
          .selectTable(schema.block(this.zkopruId).name)
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
        // TODO removed
        console.log(event)
      })
      .on('error', err => {
        console.log(err)
      })
  }

  async listenFinalization(cb?: (hash: string) => void) {
    if (this.status !== NetworkStatus.STOPPED) return
    const query = await this.db
      .selectTable(schema.block(this.zkopruId).name)
      .presetQuery('getFinalizationSyncIndex')
      .exec()
    const startFrom = query[0] ? query[0].proposedAt : 0
    this.finalizationSubscriber = this.l1Contract.coordinator.events
      .Finalized({ fromBlock: startFrom })
      .on('connected', subId => {
        console.log(subId)
      })
      .on('data', async event => {
        const { returnValues } = event
        // WRITE DATABASE
        await this.db
          .selectTable(schema.block(this.zkopruId).name)
          .presetQuery('markAsFinalized', {
            hash: returnValues,
          })
          .exec()
        if (cb) cb(returnValues)
      })
      .on('changed', event => {
        // TODO removed
        console.log(event)
      })
      .on('error', err => {
        console.log(err)
      })
  }

  async fetch(proposalHash: string) {
    if (this.fetching[proposalHash]) return
    // console.log(returnValues, transactionHash, blockNumber)
    const proposalData = await this.l1Contract.web3.eth.getTransaction(proposalHash)
    const block = deserializeBlockFromL1Tx(proposalData)
    const { hash } = block
    await this.db
      .selectTable(schema.block(this.zkopruId).name)
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
