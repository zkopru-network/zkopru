// export interface AggregatedZkTx {
//   zkTx: ZkTx
//   includedIn: Hex // block hash
// }

import express, { RequestHandler } from 'express'
import { Server } from 'http'
import { ZkTx } from '@zkopru/transaction'
import {
  VerifyOption,
  FullNode,
  BootstrapData,
  NetworkStatus,
} from '@zkopru/core'
import { InanoSQLInstance } from '@nano-sql/core'
import { WebsocketProvider, IpcProvider } from 'web3-core'
import { TxMemPool, TxPoolInterface } from './tx_pool'

type provider = WebsocketProvider | IpcProvider

export interface CoordinatorConfig {
  bootstrapNode: boolean
  provider: provider
  address: string
  db: InanoSQLInstance
  option?: VerifyOption
}

export interface CoordinatorInterface {
  start: () => void
  onTxRequest(handler: (tx: ZkTx) => Promise<string>): void
  onBlock: () => void
}

export class Coordinator {
  node: FullNode

  api?: Server

  bootstrapCache: {
    [hash: string]: BootstrapData
  }

  txPool: TxPoolInterface

  config: {
    port: number
    bootstrapNode: boolean
  }

  constructor(
    node: FullNode,
    config?: { bootstrapNode: boolean; port: number },
  ) {
    this.node = node
    this.txPool = new TxMemPool()
    this.node = node
    this.config = config || {
      port: 8888,
      bootstrapNode: true,
    }
    this.bootstrapCache = {}
  }

  start() {
    this.node.startSync()
    this.startAPI()
    this.node.synchronizer.on(
      'status',
      (status: NetworkStatus, hash?: string) => {
        // udpate the txpool using the newly proposed hash
        // if the hash does not exist in the tx pool's block list
        // create an observer to fetch the block data from database
        switch (status) {
          case NetworkStatus.FULLY_SYNCED:
            console.log(hash)
            // try to propose a block
            break
          default:
            // cancel proposal
            break
        }
      },
    )
    this.node.l1Contract.coordinator.events.NewProposal()
  }

  stop() {
    this.node.stopSync()
    this.stopAPI()
  }

  startAPI() {
    if (!this.api) {
      const app = express()
      app.post('/tx', this.txHandler)
      if (this.config.bootstrapNode) {
        app.get('/bootstrap', this.bootstrapHandler)
      }
      this.api = app.listen(this.config.port, () => {
        console.log(`Coordination API is running on port ${this.config.port}`)
      })
    }
  }

  stopAPI() {
    if (this.api) {
      this.api.close()
    }
  }

  txHandler: RequestHandler = async (req, res) => {
    const tx = ZkTx.decode(req.body)
    const result = await this.node.verifier.snarkVerifier.verifyTx(tx)
    if (result) {
      await this.txPool.addToTxPool(tx)
      res.send(result)
    } else {
      throw Error('Tx handler does not exist. run start() first')
    }
  }

  bootstrapHandler: RequestHandler = async (req, res) => {
    const { hash } = req.query
    let hashForBootstrapBlock: string
    if (typeof hash !== 'string')
      throw Error('Api accepts only a single string obj')
    if (hash) {
      hashForBootstrapBlock = hash
    } else {
      hashForBootstrapBlock = await this.node.l1Contract.upstream.methods
        .latest()
        .call()
    }
    if (this.bootstrapCache[hashForBootstrapBlock]) {
      res.send(this.bootstrapCache[hashForBootstrapBlock])
    }
    const block = await this.node.l2Chain.getBlock(hashForBootstrapBlock)
    if (!block) throw Error('Requested block is not found')
    if (!block.bootstrap) {
      throw Error('Bootstrap for requested block is not found')
    }
    return {
      txHash: block.txHash,
      utxoTreeIndex: block.bootstrap.utxoTreeIndex,
      utxoBootstrap: block.bootstrap.utxoBootstrap,
      withdrawalTreeIndex: block.bootstrap.withdrawalTreeIndex,
      withdrawalBootstrap: block.bootstrap.withdrawalBootstrap,
    }
  }
}
