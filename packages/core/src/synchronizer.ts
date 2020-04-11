import { InanoSQLInstance } from '@nano-sql/core'
import { schema } from '@zkopru/database'
import { EventEmitter } from 'events'
import { L1Contract } from './layer1'
import { blockFromLayer1Tx } from './block'
import { ContractEventEmitter } from '~contracts/contracts/types'

export class Synchronizer extends EventEmitter {
  id: string

  db: InanoSQLInstance

  l1Contract!: L1Contract

  fetching: {
    [txHash: string]: boolean
  }

  subscription?: ContractEventEmitter<string>

  constructor(db: InanoSQLInstance, zkopruId: string, l1Contract: L1Contract) {
    super()
    this.db = db
    this.id = zkopruId
    this.l1Contract = l1Contract
    this.fetching = {}
  }

  async sync() {
    if (this.subscription) console.log('Already on syncing')
    // TODO get 'from' from database
    const query = await this.db
      .selectTable(schema.block(this.id).name)
      .presetQuery('getStartSync')
      .exec()
    const startFrom = query[0] ? query[0].proposedAt : 0
    this.subscription = this.l1Contract.coordinator.events
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
        // removed
        console.log(event)
      })
      .on('error', err => {
        console.log(err)
      })
  }

  stop() {
    if (this.subscription) {
      // web3 Contract ts doesn't have unsubscribe() function property
      ;(this.subscription as any).unsubscribe()
    }
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
