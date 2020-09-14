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
import { Account, TransactionReceipt } from 'web3-core'
import { Subscription } from 'web3-core-subscriptions'
import { MassDeposit as MassDepositSql } from '@zkopru/prisma'
import { Server } from 'http'
import { Address, Bytes32, Uint256 } from 'soltypes'
import BN from 'bn.js'
import { soliditySha3Raw } from 'web3-utils'
import assert from 'assert'
import AsyncLock from 'async-lock'
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

export interface PendingMassDeposits {
  massDeposits: MassDeposit[]
  leaves: Field[]
  totalFee: Field
  calldataSize: number
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

  massDepositCommitJob?: Job

  proposeLock: AsyncLock

  constructor(node: FullNode, account: Account, config: CoordinatorConfig) {
    super()
    this.account = account
    this.node = node
    this.txPool = new TxMemPool()
    this.config = { priceMultiplier: 32, ...config }
    this.bootstrapCache = {}
    this.proposeLock = new AsyncLock()
  }

  start() {
    logger.info('Coordinator started')
    this.node.startSync()
    this.startAPI()
    this.startSubscribeGasPrice()
    this.startFinalization()
    this.startCommitMassDeposits()
    this.node.on('status', async (status: NetworkStatus) => {
      // udpate the txpool using the newly proposed hash
      // if the hash does not exist in the tx pool's block list
      // create an observer to fetch the block data from database
      logger.info(`current status: ${status}`)
      switch (status) {
        case NetworkStatus.SYNCED:
        case NetworkStatus.FULLY_SYNCED:
          this.startGenBlock()
          break
        case NetworkStatus.ON_ERROR:
          logger.error(`on error, stop generating new blocks`)
          this.stopGenBlock()
          break
        default:
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
    this.stopCommitMassDeposits()
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
  async registerVk(
    nIn: number,
    nOut: number,
    vk: any,
  ): Promise<TransactionReceipt | undefined> {
    const tx = this.node.l1Contract.setup.methods.registerVk(nIn, nOut, {
      alfa1: vk.vk_alfa_1.slice(0, 2),
      beta2: vk.vk_beta_2.slice(0, 2),
      gamma2: vk.vk_gamma_2.slice(0, 2),
      delta2: vk.vk_delta_2.slice(0, 2),
      ic: vk.IC.map(arr => arr.slice(0, 2)),
    })
    return this.node.l1Contract.sendTx(tx, this.account)
  }

  async completeSetup(): Promise<TransactionReceipt | undefined> {
    const tx = this.node.l1Contract.setup.methods.completeSetup()
    return this.node.l1Contract.sendTx(tx, this.account)
  }

  async commitMassDeposit(): Promise<TransactionReceipt | undefined> {
    const stagedDeposits = await this.node.l1Contract.upstream.methods
      .stagedDeposits()
      .call()
    if (
      Uint256.from(stagedDeposits.fee)
        .toBN()
        .gtn(0)
    ) {
      const tx = this.node.l1Contract.coordinator.methods.commitMassDeposit()
      return this.node.l1Contract.sendTx(tx, this.account)
    }
    return undefined
  }

  async registerAsCoordinator(): Promise<TransactionReceipt | undefined> {
    const { minimumStake } = this.node.l2Chain.config
    const tx = this.node.l1Contract.coordinator.methods.register()
    return this.node.l1Contract.sendTx(tx, this.account, {
      value: minimumStake,
    })
    // return this.sendTx(tx)
  }

  async deregister(): Promise<TransactionReceipt | undefined> {
    const tx = this.node.l1Contract.coordinator.methods.deregister()
    return this.node.l1Contract.sendTx(tx, this.account)
  }

  async getPendingMassDeposits(): Promise<PendingMassDeposits> {
    const leaves: Field[] = []
    let consumedBytes = 0
    let aggregatedFee: Field = Field.zero
    // 1. pick mass deposits
    const commits: MassDepositSql[] = await this.node.db.read(prisma =>
      prisma.massDeposit.findMany({
        where: { includedIn: null },
      }),
    )
    commits.sort((a, b) => parseInt(a.index, 10) - parseInt(b.index, 10))
    const pendingDeposits = await this.node.db.read(prisma =>
      prisma.deposit.findMany({
        where: { queuedAt: { in: commits.map(commit => commit.index) } },
      }),
    )
    pendingDeposits.sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) {
        return a.blockNumber - b.blockNumber
      }
      if (a.transactionIndex !== b.transactionIndex) {
        return a.transactionIndex - b.transactionIndex
      }
      // TODO HERE!!
      return a.logIndex - b.logIndex
    })
    leaves.push(...pendingDeposits.map(deposit => Field.from(deposit.note)))
    consumedBytes += commits.length
    aggregatedFee = aggregatedFee.add(
      pendingDeposits.reduce((prev, item) => prev.add(item.fee), Field.zero),
    )
    return {
      massDeposits: commits.map(commit => ({
        merged: Bytes32.from(commit.merged),
        fee: Uint256.from(commit.fee),
      })),
      leaves,
      totalFee: aggregatedFee,
      calldataSize: consumedBytes,
    }
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
    const receipt = await this.node.l1Contract.sendTx(tx, this.account, {
      value: eth,
    })
    if (receipt) {
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
      res.send(receipt)
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
      this.genBlockJob = scheduleJob('*/5 * * * * *', () => this.proposeTask())
    }
  }

  private stopGenBlock() {
    logger.info('Stop block generations')
    if (this.genBlockJob) this.genBlockJob.cancel()
    this.genBlockJob = undefined
  }

  private startCommitMassDeposits() {
    if (!this.massDepositCommitJob) {
      logger.info('Start to commit mass deposits')
      this.massDepositCommitJob = scheduleJob('*/15 * * * * *', () =>
        this.commitMassDeposit(),
      )
    }
  }

  private stopCommitMassDeposits() {
    logger.info('Stop commit massdeposit')
    if (this.massDepositCommitJob) this.massDepositCommitJob.cancel()
    this.massDepositCommitJob = undefined
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

  private async proposeTask() {
    if (this.proposeLock.isBusy('propose')) return
    await this.proposeLock.acquire('propose', async () => {
      logger.trace(`try to propose a new block`)
      try {
        const receipt = await this.proposeNewBlock()
        if (receipt) {
          await this.node.updateStatus()
        }
      } catch (err) {
        logger.error(`Error occurred during block proposing.`)
        logger.error(err)
      }
    })
  }

  private async proposeNewBlock(): Promise<TransactionReceipt | undefined> {
    if (!this.gasPrice) {
      logger.trace('Skip gen block. Gas price is not synced yet')
      return undefined
    }
    if (this.node.status !== NetworkStatus.FULLY_SYNCED) {
      logger.trace(
        `Skip gen block. Syncing layer 2 with the layer 1 - status: ${this.node.status}`,
      )
      return undefined
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
      return undefined
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
              verified: true,
              isUncle: null,
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
      return undefined
    }

    const bytes = Buffer.concat([
      serializeHeader(block.header),
      serializeBody(block.body),
    ])
    const blockData = `0x${bytes.toString('hex')}`
    const proposeTx = this.node.l1Contract.coordinator.methods.propose(
      blockData,
    )
    let expectedGas: number
    try {
      expectedGas = await proposeTx.estimateGas({
        from: this.account.address,
      })
    } catch (err) {
      logger.warn(`propose() fails. Skip gen block`)
      return undefined
    }
    const expectedFee = this.gasPrice.muln(expectedGas)
    if (block.fee.lte(expectedFee)) {
      logger.info(
        `Skip gen block. Aggregated fee is not enough yet ${block.fee} / ${expectedFee}`,
      )
      return undefined
    }
    const receipt = await this.node.l1Contract.sendTx(proposeTx, this.account, {
      gas: expectedGas,
      gasPrice: this.gasPrice.toString(),
    })
    if (receipt) {
      logger.info(`Proposed a new block: ${blockHash}`)
    } else {
      logger.warn(`Failed to propose a new block: ${blockHash}`)
    }
    return receipt
  }

  private async genBlock(): Promise<{
    header: Header
    body: Body
    fee: Field
  }> {
    if (!this.gasPrice) {
      throw Error('coordinator.js: Gas price is not synced')
    }

    // Calculate consumed bytes and aggregated fee
    let consumedBytes = 32 // bytes length
    let aggregatedFee: Field = Field.zero

    // 1. pick mass deposits
    const pendingMassDeposits = await this.getPendingMassDeposits()
    consumedBytes += pendingMassDeposits.calldataSize
    aggregatedFee = aggregatedFee.add(pendingMassDeposits.totalFee)

    // 2. pick transactions
    const pendingTxs = await this.txPool.pickTxs(
      this.config.maxBytes - consumedBytes,
      this.gasPrice.muln(this.config.priceMultiplier),
    )
    const txs = pendingTxs || []
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
      }, pendingMassDeposits.leaves)
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
      pendingMassDeposits.leaves.length ||
      txs.length ||
      this.txPool.pendingNum() ||
      withdrawals.length
    ) {
      logger.info(`Pending deposits: ${pendingMassDeposits.leaves.length}`)
      logger.info(`Picked txs: ${txs.length}`)
      logger.info(`Pending txs: ${this.txPool.pendingNum()}`)
      logger.info(`Withdrawals: ${withdrawals.length}`)
    }
    const nullifiers = txs.reduce((arr, tx) => {
      return [...arr, ...tx.inflow.map(inflow => inflow.nullifier)]
    }, [] as Field[])

    const latest = await this.node.latestBlock()
    logger.info(`Trying to create a child block of ${latest}`)
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
    const { massDeposits } = pendingMassDeposits
    const header: Header = {
      proposer: Address.from(this.account.address),
      parentBlock: Bytes32.from(latest),
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
        const receipt = await this.node.l1Contract.sendTx(tx, this.account)
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
    const currentBlockNumber: number = await this.node.l1Contract.web3.eth.getBlockNumber()
    const l1Config = await this.node.l1Contract.getConfig()
    const unfinalizedProposals = await this.node.db.read(prisma =>
      prisma.proposal.findMany({
        where: {
          AND: [
            { finalized: null },
            { block: { header: { parentBlock: latest } } },
            { verified: true },
            { isUncle: null },
            { proposalData: { not: null } },
            {
              proposedAt: { lt: currentBlockNumber - l1Config.challengePeriod },
            },
          ],
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
    logger.trace(`latest: ${latest}`)
    logger.trace(`finalization block: ${block.hash.toString()}`)
    logger.trace(
      `header deposit root: ${finalization.header.depositRoot.toString()}`,
    )
    logger.trace(
      `calculated root: ${root(
        finalization.massDeposits.map(massDepositHash),
      )}`,
    )
    return finalization
  }
}
