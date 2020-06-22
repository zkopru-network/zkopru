import { Field } from '@zkopru/babyjubjub'
import express, { RequestHandler } from 'express'
import { scheduleJob, Job } from 'node-schedule'
import { EventEmitter } from 'events'
import {
  ZkTx,
  OutflowType,
  Withdrawal,
  WithdrawalStatus,
} from '@zkopru/transaction'
import { Leaf } from '@zkopru/tree'
import { logger, root, bnToBytes32, bnToUint256 } from '@zkopru/utils'
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
  headerHash,
  Block,
  getMassMigrations,
  Finalization,
  serializeFinalization,
} from '@zkopru/core'
import { Account } from 'web3-core'
import { Subscription } from 'web3-core-subscriptions'
import { MassDeposit as MassDepositSql } from '@zkopru/prisma'
import { Server } from 'http'
import chalk from 'chalk'
import { Address, Bytes32, Uint256 } from 'soltypes'
import BN from 'bn.js'
import { soliditySha3Raw } from 'web3-utils'
import assert from 'assert'
import { TxMemPool, TxPoolInterface } from './tx_pool'

export interface CoordinatorConfig {
  maxBytes: number
  bootstrap: boolean
  port: number
  priceMultiplier: number // gas per byte is 16, our default value is 32
}

export interface CoordinatorInterface {
  start: () => void
  onTxRequest(handler: (tx: ZkTx) => Promise<string>): void
  onBlock: () => void
}

export class Coordinator extends EventEmitter {
  node: FullNode

  api?: Server

  bootstrapCache: {
    [hash: string]: BootstrapData
  }

  account: Account

  gasPriceSubscriber?: Subscription<unknown>

  gasPrice?: Field

  txPool: TxPoolInterface

  config: CoordinatorConfig

  genBlockJob?: Job

  finalizationJob?: Job

  constructor(node: FullNode, account: Account, config: CoordinatorConfig) {
    super()
    this.account = account
    this.node = node
    this.txPool = new TxMemPool()
    this.config = { priceMultiplier: 32, ...config }
    this.bootstrapCache = {}
  }

  start() {
    logger.info('Coordinator started')
    this.node.startSync()
    this.startAPI()
    this.startSubscribeGasPrice()
    this.startFinalization()
    this.node.on('status', async (status: NetworkStatus) => {
      // udpate the txpool using the newly proposed hash
      // if the hash does not exist in the tx pool's block list
      // create an observer to fetch the block data from database
      switch (status) {
        case NetworkStatus.SYNCED:
        case NetworkStatus.FULLY_SYNCED:
          this.startGenBlock()
          break
        default:
          this.stopGenBlock()
          // cancel proposal
          break
      }
    })
    this.node.on('onFetched', (block: Block) => {
      this.txPool.markAsIncluded(block.body.txs)
    })
    this.emit('start')
  }

  async stop(): Promise<void> {
    // TODO : stop api & gas price subscriber / remove listeners
    this.stopGenBlock()
    this.stopFinalization()
    return new Promise(res => {
      this.node.on('status', status => {
        if (status === NetworkStatus.STOPPED) {
          this.emit('stop')
          res()
        }
      })
      if (this.api) {
        this.api.close(() => {
          if (this.node.status === NetworkStatus.STOPPED) {
            res()
          } else {
            this.node.stopSync()
          }
        })
      } else if (this.node.status === NetworkStatus.STOPPED) {
        res()
      } else {
        this.node.stopSync()
      }
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async registerVk(nIn: number, nOut: number, vk: any): Promise<any> {
    const tx = this.node.l1Contract.setup.methods.registerVk(
      nIn,
      nOut,
      vk.vk_alfa_1.slice(0, 2),
      vk.vk_beta_2.slice(0, 2),
      vk.vk_gamma_2.slice(0, 2),
      vk.vk_delta_2.slice(0, 2),
      vk.IC.map(arr => arr.slice(0, 2)),
    )
    return this.node.l1Contract.sendTx(tx, { from: this.account.address })
  }

  async completeSetup(): Promise<any> {
    const tx = this.node.l1Contract.setup.methods.completeSetup()
    return this.node.l1Contract.sendTx(tx, { from: this.account.address })
  }

  async commitMassDeposit(): Promise<any> {
    const tx = this.node.l1Contract.coordinator.methods.commitMassDeposit()
    return this.node.l1Contract.sendTx(tx, { from: this.account.address })
  }

  async registerAsCoordinator(): Promise<any> {
    const { minimumStake } = this.node.l2Chain.config
    const tx = this.node.l1Contract.coordinator.methods.register()
    return this.node.l1Contract.sendTx(tx, {
      value: minimumStake,
      from: this.account.address,
    })
    // return this.sendTx(tx)
  }

  async deregister(): Promise<any> {
    const tx = this.node.l1Contract.coordinator.methods.deregister()
    return this.node.l1Contract.sendTx(tx, { from: this.account.address })
  }

  private startAPI() {
    if (!this.api) {
      const app = express()
      app.use(express.text())
      app.post('/tx', this.txHandler)
      app.post('/instant-withdraw', this.instantWithdrawHandler)
      if (this.config.bootstrap) {
        app.get('/bootstrap', this.bootstrapHandler)
      }
      app.get('/price', this.bytePriceHandler)
      this.api = app.listen(this.config.port, () => {
        logger.info(
          `coordinator.js: API is running on apiPort ${this.config.port}`,
        )
      })
    }
  }

  private async startSubscribeGasPrice() {
    if (this.gasPriceSubscriber) return
    this.gasPrice = Field.from(
      await this.node.l1Contract.web3.eth.getGasPrice(),
    )
    this.gasPriceSubscriber = this.node.l1Contract.web3.eth.subscribe(
      'newBlockHeaders',
      async () => {
        this.gasPrice = Field.from(
          await this.node.l1Contract.web3.eth.getGasPrice(),
        )
      },
    )
  }

  private txHandler: RequestHandler = async (req, res) => {
    const txData = req.body
    logger.info(`tx data is${txData}`)
    logger.info(txData)
    const zkTx = ZkTx.decode(Buffer.from(txData, 'hex'))
    // const zkTx = ZkTx.decode(txData)
    const result = await this.node.verifier.snarkVerifier.verifyTx(zkTx)
    if (result) {
      logger.info('add a transaction')
      await this.txPool.addToTxPool(zkTx)
      res.send(result)
    } else {
      logger.info('Failed to verify zk snark')
      res.status(500).send('Coordinator is not running')
    }
  }

  private instantWithdrawHandler: RequestHandler = async (req, res) => {
    const withdrawalData = req.body
    const withdrawal = JSON.parse(withdrawalData)
    const {
      hash,
      to,
      eth,
      tokenAddr,
      erc20Amount,
      nft,
      fee,
      includedIn,
      index,
      sign,
    } = withdrawal
    // TODO verify request
    // TODO check fee
    const siblings: string[] = JSON.parse(withdrawal.siblings)
    const tx = this.node.l1Contract.user.methods.payInAdvance(
      hash,
      to,
      eth,
      tokenAddr,
      erc20Amount,
      nft,
      fee,
      sign.signature,
    )
    const withdrawalHash = soliditySha3Raw(
      hash,
      to,
      eth,
      tokenAddr,
      erc20Amount,
      nft,
      fee,
    )
    const result = await this.node.l1Contract.sendTx(tx, {
      value: eth,
      from: this.account.address,
    })
    if (result) {
      // save withdrawal
      logger.info('pay in advance')
      const data = {
        hash,
        withdrawalHash,
        to,
        eth,
        tokenAddr,
        erc20Amount,
        nft,
        fee,
        includedIn,
        index,
        siblings: JSON.stringify(siblings),
        status: WithdrawalStatus.UNFINALIZED,
      }
      await this.node.db.write(prisma =>
        prisma.withdrawal.upsert({
          where: { hash },
          create: data,
          update: data,
        }),
      )
      res.send(result)
    } else {
      // set prepayed
      logger.info('Failed to run pay-in-advance')
      res.status(500).send('Failed to run pay-in-advance')
    }
  }

  private bootstrapHandler: RequestHandler = async (req, res) => {
    const { hash } = req.query
    logger.info(`bootstrap called for ${hash}`)
    let hashForBootstrapBlock: string
    if (typeof hash !== 'string') {
      logger.info('Api accepts only a single string obj')
      res.status(500).send('API accepts only a single string')
      return
    }
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
    const blockHash = Bytes32.from(hashForBootstrapBlock)
    const block = await this.node.l2Chain.getBlock(blockHash)
    const proposal = await this.node.l2Chain.getProposal(blockHash)
    if (!proposal) {
      const message = `Failed to find a proposal for the requested  ${hash}`
      logger.info(message)
      res.status(500).send(message)
      return
    }
    if (!block) {
      const message = `Failed to find the requested block ${hash}`
      logger.info(message)
      res.status(500).send(message)
      return
    }
    if (!block.bootstrap) {
      const message = `Bootstrap for the requested block ${hash} does not exist`
      logger.info(message)
      res.status(500).send(message)
      return
    }
    res.send({
      proposalTx: proposal.proposalTx,
      blockHash: block.hash,
      utxoTreeIndex: block.bootstrap.utxoTreeIndex,
      utxoStartingLeafProof: {
        root: block.header.utxoRoot.toString(),
        index: block.header.utxoIndex.toString(),
        leaf: Field.zero.toHex(),
        siblings: block.bootstrap.utxoBootstrap.map(s => s.toString()),
      },
      withdrawalTreeIndex: block.bootstrap.withdrawalTreeIndex,
      withdrawalStartingLeafProof: {
        root: block.header.withdrawalRoot.toString(),
        index: block.header.withdrawalIndex.toString(),
        leaf: Field.zero,
        siblings: block.bootstrap.withdrawalBootstrap.map(s => s.toString()),
      },
    })
  }

  private bytePriceHandler: RequestHandler = async (_, res) => {
    const weiPerByte: string | undefined = this.gasPrice
      ?.muln(this.config.priceMultiplier)
      .toString(10)
    res.send({ weiPerByte })
  }

  private startGenBlock() {
    if (!this.genBlockJob) {
      logger.info('Start block generations')
      this.genBlockJob = scheduleJob('*/5 * * * * *', () =>
        this.proposeNewBlocks(),
      )
    }
  }

  private stopGenBlock() {
    logger.info('Stop block generations')
    if (this.genBlockJob) this.genBlockJob.cancel()
    this.genBlockJob = undefined
  }

  private startFinalization() {
    if (!this.finalizationJob) {
      logger.info('Start finalization')
      this.finalizationJob = scheduleJob('*/5 * * * * *', () =>
        this.finalizeBlock(),
      )
    }
  }

  private stopFinalization() {
    logger.info('Stop finalization')
    if (this.finalizationJob) this.finalizationJob.cancel()
    this.finalizationJob = undefined
  }

  private async proposeNewBlocks() {
    if (!this.gasPrice) {
      logger.trace('Skip gen block. Gas price is not synced yet')
      return
    }
    if (this.node.status !== NetworkStatus.FULLY_SYNCED) {
      logger.trace(
        `Skip gen block. Syncing layer 2 with the layer 1 - status: ${this.node.status}`,
      )
      return
    }
    let block: {
      header: Header
      body: Body
      fee: Field
    }
    try {
      block = await this.genBlock()
    } catch (err) {
      logger.warn(`Failed to gen block: ${err}`)
      return
    }
    const blockHash = headerHash(block.header)
    const siblingProposals = await this.node.db.read(prisma =>
      prisma.proposal.findMany({
        where: {
          OR: [
            {
              block: {
                header: { parentBlock: block.header.parentBlock.toString() },
              },
              invalidated: false,
            },
            {
              hash: blockHash.toString(),
            },
          ],
        },
      }),
    )
    if (siblingProposals.length > 0) {
      logger.info(`Already proposed for the given parent block`)
      return
    }

    const bytes = Buffer.concat([
      serializeHeader(block.header),
      serializeBody(block.body),
    ])
    const blockData = `0x${bytes.toString('hex')}`
    let expectedGas: number
    try {
      expectedGas = await this.node.l1Contract.coordinator.methods
        .propose(blockData)
        .estimateGas({
          from: this.account.address,
        })
    } catch (err) {
      logger.warn(`propose() fails. Skip gen block`)
      return
    }
    const expectedFee = this.gasPrice.muln(expectedGas)
    if (block.fee.lte(expectedFee)) {
      logger.info(
        `Skip gen block. Aggregated fee is not enough yet ${block.fee} / ${expectedFee}`,
      )
    } else {
      logger.info(chalk.green(`Proposed a new block: ${blockHash}`))
      await this.node.l1Contract.coordinator.methods.propose(blockData).send({
        from: this.account.address,
        gas: expectedGas,
        gasPrice: this.gasPrice.toString(),
      })
    }
  }

  private async genBlock(): Promise<{
    header: Header
    body: Body
    fee: Field
  }> {
    // TODO use node lock
    const deposits: Field[] = []
    let consumedBytes = 0
    let aggregatedFee: Field = Field.zero
    // 1. pick mass deposits
    const commits: MassDepositSql[] = await this.node.db.read(prisma =>
      prisma.massDeposit.findMany({
        where: {
          includedIn: null,
        },
      }),
    )
    commits.sort((a, b) => parseInt(a.index, 10) - parseInt(b.index, 10))
    const pendingDeposits = await this.node.db.read(prisma =>
      prisma.deposit.findMany({
        where: {
          queuedAt: {
            in: commits.map(commit => commit.index),
          },
        },
      }),
    )
    pendingDeposits.sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) {
        return a.blockNumber - b.blockNumber
      }
      if (a.transactionIndex !== b.transactionIndex) {
        return a.transactionIndex - b.transactionIndex
      }
      return a.logIndex - b.logIndex
    })
    deposits.push(...pendingDeposits.map(deposit => Field.from(deposit.note)))
    consumedBytes += 32 * commits.length
    aggregatedFee = aggregatedFee.add(
      pendingDeposits.reduce((prev, item) => prev.add(item.fee), Field.zero),
    )

    // 2. pick transactions
    if (!this.gasPrice) {
      throw Error('coordinator.js: Gas price is not synced')
    }
    const txs =
      (await this.txPool.pickTxs(
        this.config.maxBytes - consumedBytes,
        this.gasPrice.muln(this.config.priceMultiplier),
      )) || []
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
      .map(hash => ({ hash })) as Leaf<Field>[]

    const withdrawals: Leaf<BN>[] = txs.reduce((arr, tx) => {
      return [
        ...arr,
        ...tx.outflow
          .filter(outflow => outflow.outflowType.eqn(OutflowType.WITHDRAWAL))
          .map(outflow => {
            if (!outflow.data) throw Error('No withdrawal public data')
            return {
              hash: Withdrawal.withdrawalHash(
                outflow.note,
                outflow.data,
              ).toBN(),
              noteHash: outflow.note,
            }
          }),
      ]
    }, [] as Leaf<BN>[])

    if (
      pendingDeposits.length ||
      txs.length ||
      this.txPool.pendingNum() ||
      withdrawals.length
    ) {
      logger.info(`Pending deposits: ${pendingDeposits.length}`)
      logger.info(`Picked txs: ${txs.length}`)
      logger.info(`Pending txs: ${this.txPool.pendingNum()}`)
      logger.info(`Withdrawals: ${withdrawals.length}`)
    }
    const nullifiers = txs.reduce((arr, tx) => {
      return [...arr, ...tx.inflow.map(inflow => inflow.nullifier)]
    }, [] as Field[])

    const latest = await this.node.latestBlock()
    if (!latest) {
      throw Error('Layer 2 chain is not synced yet.')
    }
    // TODO acquire lock during gen block
    const massMigrations: MassMigration[] = getMassMigrations(txs)
    const expectedGrove = await this.node.l2Chain.grove.dryPatch({
      utxos,
      withdrawals,
      nullifiers,
    })
    logger.info(
      `nullifiers: ${JSON.stringify(nullifiers.map(f => f.toString()))}`,
    )
    if (!expectedGrove.nullifierTreeRoot) {
      throw Error(
        'Grove does not have the nullifier tree. Use full node option',
      )
    }
    const massDeposits: MassDeposit[] = commits.map(obj => ({
      merged: Bytes32.from(obj.merged),
      fee: Uint256.from(obj.fee),
    }))
    const header: Header = {
      proposer: Address.from(this.account.address),
      parentBlock: Bytes32.from(latest),
      metadata: Bytes32.from(
        '0x0000000000000000000000000000000000000000000000000000000000000000',
      ),
      fee: aggregatedFee.toUint256(),
      utxoRoot: expectedGrove.utxoTreeRoot.toUint256(),
      utxoIndex: expectedGrove.utxoTreeIndex.toUint256(),
      nullifierRoot: bnToBytes32(expectedGrove.nullifierTreeRoot),
      withdrawalRoot: bnToUint256(expectedGrove.withdrawalTreeRoot),
      withdrawalIndex: bnToUint256(expectedGrove.withdrawalTreeIndex),
      txRoot: root(txs.map(tx => tx.hash())),
      depositRoot: root(massDeposits.map(massDepositHash)),
      migrationRoot: root(massMigrations.map(massMigrationHash)),
    }
    const body: Body = {
      txs,
      massDeposits,
      massMigrations,
    }
    return { header, body, fee: aggregatedFee }
  }

  private async finalizeBlock() {
    const finalization = await this.genFinalization()
    if (!finalization) return
    logger.info('finalization')
    const blockHash = headerHash(finalization.header).toString()
    const tx = this.node.l1Contract.coordinator.methods.finalize(
      `0x${serializeFinalization(finalization).toString('hex')}`,
    )
    let finalizable = false
    try {
      await tx.call({ from: this.account.address })
      finalizable = true
    } catch (err) {
      logger.error(err)
      return
    }
    if (finalizable) {
      try {
        const receipt = await this.node.l1Contract.sendTx(tx, {
          from: this.account.address,
        })
        if (receipt) {
          await this.node.db.write(prisma =>
            prisma.proposal.update({
              where: { hash: blockHash },
              data: { finalized: true },
            }),
          )
          logger.info(`finalized block ${blockHash}`)
        } else {
          logger.warn(`Failed to finalize the block ${blockHash}`)
        }
      } catch (err) {
        logger.error(err)
      }
    }
  }

  private async genFinalization(): Promise<Finalization | undefined> {
    const latest = await this.node.l1Contract.upstream.methods.latest().call()
    const unfinalizedProposals = await this.node.db.read(prisma =>
      prisma.proposal.findMany({
        where: {
          finalized: null,
          block: {
            header: { parentBlock: latest },
            verified: true,
          },
          proposalData: { not: null },
        },
        take: 1,
      }),
    )
    const proposalToFinalize = unfinalizedProposals[0]
    if (!proposalToFinalize) return undefined
    assert(proposalToFinalize.proposalData)

    const tx = JSON.parse(proposalToFinalize.proposalData)
    const block = Block.fromTx(tx, true)

    const finalization: Finalization = block.getFinalization()
    return finalization
  }
}
