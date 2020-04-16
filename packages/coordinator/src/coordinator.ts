import { Field } from '@zkopru/babyjubjub'
import bigInt from 'big-integer'

import express, { RequestHandler } from 'express'
import { scheduleJob, Job } from 'node-schedule'
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
import { Subscription } from 'web3-core-subscriptions'
import { TxMemPool, TxPoolInterface } from './tx_pool'

type provider = WebsocketProvider | IpcProvider

export interface CoordinatorConfig {
  priceMultiplier: number // 32 gas is the current default price for 1 byte
  maxBytes: number
  minimumFee: Field
  bootstrapNode: boolean
  provider: provider
  address: string
  db: InanoSQLInstance
  option?: VerifyOption
  apiPort: number
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

  gasPriceSubscriber?: Subscription<unknown>

  bytePrice?: Field

  txPool: TxPoolInterface

  config: CoordinatorConfig

  genBlockJob?: Job

  constructor(node: FullNode, config: CoordinatorConfig) {
    this.node = node
    this.txPool = new TxMemPool()
    this.node = node
    this.config = config
    this.bootstrapCache = {}
  }

  getMinimumFee(): Field | null {
    if (!this.bytePrice) return null
    return this.config.minimumFee
  }

  start() {
    this.node.startSync()
    this.startAPI()
    this.node.synchronizer.on(
      'status',
      async (status: NetworkStatus, blockHash?: string) => {
        // udpate the txpool using the newly proposed hash
        // if the hash does not exist in the tx pool's block list
        // create an observer to fetch the block data from database
        switch (status) {
          case NetworkStatus.FULLY_SYNCED:
            // It tries to propose a block until any block is proposed to the layer1
            if (blockHash) {
              const block = await this.node.l2Chain.getBlock(blockHash)
              if (block) {
                this.txPool.removeFromTxPool(block.body.txs)
              }
            }
            this.startGenBlock()
            break
          default:
            this.stopGenBlock()
            // cancel proposal
            break
        }
      },
    )
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
      this.api = app.listen(this.config.apiPort, () => {
        console.log(
          `Coordination API is running on apiPort ${this.config.apiPort}`,
        )
      })
    }
  }

  stopAPI() {
    if (this.api) {
      this.api.close()
    }
  }

  startSubscribeGasPrice() {
    if (this.gasPriceSubscriber) return
    this.gasPriceSubscriber = this.node.l1Contract.web3.eth.subscribe(
      'newBlockHeaders',
      async () => {
        const gasPrice = await this.node.l1Contract.web3.eth.getGasPrice()
        this.bytePrice = Field.from(
          bigInt(gasPrice).multiply(this.config.priceMultiplier),
        )
      },
    )
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

  bootstrapHandler: RequestHandler = async (
    req,
    res,
  ): Promise<BootstrapData> => {
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
    const block = await this.node.l2Chain.getBlockSql(hashForBootstrapBlock)
    if (!block) throw Error('Requested block is not found')
    if (!block.bootstrap) {
      throw Error('Bootstrap for requested block is not found')
    }
    return {
      proposalHash: block.proposalHash,
      blockHash: block.hash,
      utxoTreeIndex: block.bootstrap.utxoTreeIndex,
      utxoStartingLeafProof: {
        root: Field.from(block.header.utxoRoot),
        index: Field.from(block.header.utxoIndex),
        leaf: Field.zero,
        siblings: block.bootstrap.utxoBootstrap.map(Field.from),
      },
      withdrawalTreeIndex: block.bootstrap.withdrawalTreeIndex,
      withdrawalStartingLeafProof: {
        root: Field.from(block.header.withdrawalRoot),
        index: Field.from(block.header.withdrawalIndex),
        leaf: Field.zero,
        siblings: block.bootstrap.withdrawalBootstrap.map(Field.from),
      },
    }
  }

  bytePriceHandler: RequestHandler = async (req, res) => {
    console.log(req, res)
  }

  private startGenBlock() {
    if (!this.genBlockJob)
      this.genBlockJob = scheduleJob('*/5 * * * * *', this.genBlock)
  }

  private stopGenBlock() {
    if (this.genBlockJob) this.genBlockJob.cancel()
    this.genBlockJob = undefined
  }

  private genBlock() {
    // 1. pick mass deposits
    // 1. pick transactions
    this.txPool.pickTxs(this.config.maxBytes, this.config.minimumFee)
    // 2. check the validity of the transactions
    // 3. if there exists invalid transactions, remove them from the tx pool and try genBlock recursively
    // 4. generate a new block and propose it
  }
}
