import { InanoSQLInstance } from '@nano-sql/core'
import { schema } from '@zkopru/database'
import { EventEmitter } from 'events'
import { L1Contract } from './layer1'
import { blockFromLayer1Tx } from './block'

export class Synchronizer extends EventEmitter {
  id: string

  isSyncing: boolean

  db: InanoSQLInstance

  l1Contract!: L1Contract

  fetching: {
    [txHash: string]: boolean
  }

  proposalSubscriber?: EventEmitter

  finalizationSubscriber?: EventEmitter

  constructor(db: InanoSQLInstance, zkopruId: string, l1Contract: L1Contract) {
    super()
    this.db = db
    this.id = zkopruId
    this.l1Contract = l1Contract
    this.fetching = {}
    this.isSyncing = false
  }

  async sync() {
    this.isSyncing = true
    this.listenNewProposals()
    this.listenFinalization()
  }

  async listenFinalization() {
    if (this.isSyncing) return
    // TODO get 'from' from database
    const query = await this.db
      .selectTable(schema.block(this.id).name)
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
          .selectTable(schema.block(this.id).name)
          .presetQuery('markAsFinalized', {
            hash: returnValues,
          })
          .exec()
      })
      .on('changed', event => {
        // TODO removed
        console.log(event)
      })
      .on('error', err => {
        console.log(err)
      })
  }

  async listenNewProposals() {
    if (this.isSyncing) return
    // TODO get 'from' from database
    const query = await this.db
      .selectTable(schema.block(this.id).name)
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
          .selectTable(schema.block(this.id).name)
          .presetQuery('writeNewProposal', {
            hash: returnValues,
            proposedAt: blockNumber,
            txHash: transactionHash,
          })
          .exec()
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

  stop() {
    if (this.proposalSubscriber) {
      this.proposalSubscriber.removeAllListeners()
    }
    if (this.finalizationSubscriber) {
      this.finalizationSubscriber.removeAllListeners()
    }
    this.isSyncing = false
  }

  async fetch(txHash: string) {
    if (this.fetching[txHash]) return
    // console.log(returnValues, transactionHash, blockNumber)
    const txData = await this.l1Contract.web3.eth.getTransaction(txHash)
    const block = blockFromLayer1Tx(txData)
    const { hash } = block
    await this.db
      .selectTable(schema.block(this.id).name)
      .presetQuery('saveFetchedBlock', {
        hash,
        header: block.header,
        txData,
      })
      .exec()
    delete this.fetching[txHash]
    this.emit('newBlock', block)
  }
}
