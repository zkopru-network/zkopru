import { Field } from '@zkopru/babyjubjub'
import express, { RequestHandler } from 'express'
import { scheduleJob, Job } from 'node-schedule'
import { Server } from 'http'
import { ZkTx } from '@zkopru/transaction'
import { logger, root } from '@zkopru/utils'
import {
  FullNode,
  BootstrapData,
  NetworkStatus,
  Header,
  Body,
  MassMigration,
  massMigrationHash,
  massDepositHash,
  MassDeposit,
  serializeBody,
  serializeHeader,
} from '@zkopru/core'
import { InanoSQLInstance } from '@nano-sql/core'
import { Subscription } from 'web3-core-subscriptions'
import { schema, MassDepositCommitSql, DepositSql } from '@zkopru/database'
import { Item } from '@zkopru/tree'
import { TxMemPool, TxPoolInterface } from './tx_pool'


export interface CoordinatorConfig {
  maxBytes: number
  bootstrapNode: boolean
  db: InanoSQLInstance
  apiPort: number
  priceMultiplier: number // gas per byte is 16, our default value is 32
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

  gasPrice?: Field

  txPool: TxPoolInterface

  config: CoordinatorConfig

  genBlockJob?: Job

  constructor(node: FullNode, config: CoordinatorConfig) {
    this.node = node
    this.txPool = new TxMemPool()
    this.node = node
    this.config = { priceMultiplier: 32, ...config }
    this.bootstrapCache = {}
  }

  start() {
    logger.info('Coordinator started')
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
                this.txPool.markAsIncluded(block.body.txs)
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
        logger.info(
          `coordinator.js: API is running on apiPort ${this.config.apiPort}`,
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
        this.gasPrice = Field.from(
          await this.node.l1Contract.web3.eth.getGasPrice(),
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
      this.genBlockJob = scheduleJob('*/5 * * * * *', this.proposeNewBlocks)
  }

  private stopGenBlock() {
    if (this.genBlockJob) this.genBlockJob.cancel()
    this.genBlockJob = undefined
  }

  private async proposeNewBlocks() {
    const block = await this.genBlock()
    if (block) {
      const bytes = Buffer.concat([
        serializeHeader(block.header),
        serializeBody(block.body),
      ])
      await this.node.l1Contract.coordinator.methods
        .propose(`0x${bytes.toString('hex')}`)
        .send()
    }
  }

  private async genBlock(): Promise<{ header: Header; body: Body } | null> {
    const deposits: Field[] = []
    let consumedBytes = 0
    let aggregatedFee: Field = Field.zero
    // 1. pick mass deposits
    const commits: MassDepositCommitSql[] = (await this.config.db
      .selectTable(schema.massDeposit.name)
      .query('select')
      .where(['includedIn', '=', 'NOT_INCLUDED'])
      .exec()) as MassDepositCommitSql[]
    commits.sort((a, b) => parseInt(a.index, 10) - parseInt(b.index, 10))
    const allPendingDeposits: DepositSql[] = []
    for (const commit of commits) {
      const pendingDeposits = (await this.config.db
        .selectTable(schema.deposit.name)
        .presetQuery('getDeposits', {
          commitIndex: commit.index,
          zkopru: commit.zkopru,
        })
        .exec()) as DepositSql[]
      allPendingDeposits.push(...pendingDeposits)
    }
    deposits.push(
      ...allPendingDeposits.map(deposit => Field.from(deposit.note)),
    )
    consumedBytes += 32 * commits.length
    aggregatedFee = aggregatedFee.add(
      allPendingDeposits.reduce((prev, item) => prev.add(item.fee), Field.zero),
    )

    // 2. pick transactions
    if (!this.gasPrice) {
      logger.info('coordinator.js: Gas price is not synced yet')
      return null
    }
    const txs = await this.txPool.pickTxs(
      this.config.maxBytes - consumedBytes,
      160000,
      this.gasPrice.muln(this.config.priceMultiplier),
    )
    if (!txs) {
      logger.info('coordinator.js: Not enough transactions to generate a block')
      return null
    }
    aggregatedFee = aggregatedFee.add(
      txs.map(tx => tx.fee).reduce((prev, fee) => prev.add(fee), Field.zero),
    )
    // TODO 3 make sure every nullifier is unique and not used before
    // * if there exists invalid transactions, remove them from the tx pool and try genBlock recursively

    const utxos = txs
      .reduce((arr, tx) => {
        return [
          ...arr,
          ...tx.outflow
            .filter(outflow => outflow.outflowType.isZero())
            .map(outflow => outflow.note),
        ]
      }, deposits)
      .map(leafHash => ({ leafHash })) as Item[]

    const withdrawals = txs.reduce((arr, tx) => {
      return [
        ...arr,
        ...tx.outflow
          .filter(outflow => outflow.outflowType.eqn(1))
          .map(outflow => outflow.note),
      ]
    }, [] as Field[])

    const nullifiers = txs.reduce((arr, tx) => {
      return [...arr, ...tx.inflow.map(inflow => inflow.nullifier)]
    }, [] as Field[])

    const massMigrations: MassMigration[] = []
    const expectedGrove = await this.node.l2Chain.grove.dryPatch({
      utxos,
      withdrawals,
      nullifiers,
    })

    if (!expectedGrove.nullifierTreeRoot)
      throw Error(
        'Grove does not have the nullifier tree. Use full node option',
      )
    if (!this.node.l1Contract.web3.defaultAccount)
      throw Error('set account first')
    const header: Header = {
      proposer: this.node.l1Contract.web3.defaultAccount,
      parentBlock: this.node.l2Chain.latest.toHex(),
      metadata: '',
      fee: aggregatedFee.toHex(),
      utxoRoot: expectedGrove.utxoTreeRoot.toHex(),
      utxoIndex: expectedGrove.utxoTreeIndex.toHex(),
      nullifierRoot: expectedGrove.nullifierTreeRoot?.toHex(),
      withdrawalRoot: expectedGrove.withdrawalTreeRoot.toHex(),
      withdrawalIndex: expectedGrove.withdrawalTreeIndex.toHex(),
      txRoot: root(txs.map(tx => tx.hash())).toString(),
      depositRoot: root(commits.map(massDepositHash)).toString(),
      migrationRoot: root(massMigrations.map(massMigrationHash)).toString(),
    }
    const massDeposits: MassDeposit[] = commits.map(obj => ({
      merged: obj.merged,
      fee: obj.fee,
    }))
    const body: Body = {
      txs,
      massDeposits,
      massMigrations,
    }
    return { header, body }
    // 4. generate a new block and propose it
  }
}
