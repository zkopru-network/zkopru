import { Fp } from '@zkopru/babyjubjub'
import { EventEmitter } from 'events'
import { ZkTx } from '@zkopru/transaction'
import { logger, root, Worker } from '@zkopru/utils'
import {
  FullNode,
  NetworkStatus,
  massDepositHash,
  headerHash,
  Block,
  Finalization,
  serializeFinalization,
  L1Contract,
  L2Chain,
  serializeBody,
  serializeHeader,
  MAX_MASS_DEPOSIT_COMMIT_GAS,
} from '@zkopru/core'
import assert from 'assert'
import AsyncLock from 'async-lock'
import fetch from 'node-fetch'
import { BigNumber, BigNumberish, Signer } from 'ethers'
import { TransactionReceipt } from '@ethersproject/providers'
import { IBurnAuction__factory } from '@zkopru/contracts'
import { parseUnits } from 'ethers/lib/utils'
import { TxMemPool } from './tx-pool'
import { CoordinatorConfig, CoordinatorContext } from './context'
import { GeneratorBase } from './middlewares/interfaces/generator-base'
import { ProposerBase } from './middlewares/interfaces/proposer-base'
import { BlockGenerator } from './middlewares/default/block-generator'
import { BlockProposer } from './middlewares/default/block-proposer'
import { CoordinatorApi } from './api'
import { AuctionMonitor } from './auction-monitor'

export interface CoordinatorInterface {
  start: () => void
  onTxRequest(handler: (tx: ZkTx) => Promise<string>): void
  onBlock: () => void
}

export interface MiddlewareOption {
  generator?: GeneratorBase
  proposer?: ProposerBase
}

export interface Middlewares {
  generator: GeneratorBase
  proposer: ProposerBase
}

export class Coordinator extends EventEmitter {
  context: CoordinatorContext

  api: CoordinatorApi

  taskRunners: {
    blockPropose: Worker<void>
    blockFinalize: Worker<void>
    massDepositCommit: Worker<TransactionReceipt | void>
  }

  proposeLock: AsyncLock

  middlewares: Middlewares

  currentRound: number | undefined

  constructor(
    node: FullNode,
    account: Signer,
    config: CoordinatorConfig,
    middlewares?: MiddlewareOption,
  ) {
    super()
    this.context = {
      account,
      node,
      auctionMonitor: new AuctionMonitor(node, account, config),
      txPool: new TxMemPool(node.db, node.layer2),
      // eslint-disable-next-line prefer-object-spread
      config: Object.assign({ priceMultiplier: 32 }, config),
    }
    this.api = new CoordinatorApi(this.context)
    this.proposeLock = new AsyncLock()
    this.taskRunners = {
      blockPropose: new Worker(),
      blockFinalize: new Worker(),
      massDepositCommit: new Worker(),
    }
    this.middlewares = {
      generator: middlewares?.generator || new BlockGenerator(this.context),
      proposer: middlewares?.proposer || new BlockProposer(this.context),
    }
  }

  layer1(): L1Contract {
    return this.context.node.layer1
  }

  layer2(): L2Chain {
    return this.context.node.layer2
  }

  node(): FullNode {
    return this.context.node
  }

  async start() {
    logger.info('coordinator/coordinator.ts - Starting coordinator')
    await this.context.txPool.loadPendingTx()
    this.context.node.synchronizer.on(
      'status',
      async (status: NetworkStatus) => {
        // udpate the txpool using the newly proposed hash
        // if the hash does not exist in the tx pool's block list
        // create an observer to fetch the block data from database
        logger.info(`coordinator/coordinator.ts - current status: ${status}`)
        switch (status) {
          case NetworkStatus.SYNCED:
          case NetworkStatus.FULLY_SYNCED:
            if (!this.taskRunners.blockPropose.isRunning()) {
              this.taskRunners.blockPropose.start({
                task: this.proposeTask.bind(this),
                interval: 10000,
              })
            }
            break
          case NetworkStatus.ON_ERROR:
            logger.error(
              `coordinator/coordinator.ts - on error, stop generating new blocks`,
            )
            this.taskRunners.blockPropose.stop()
            break
          default:
            break
        }
      },
    )
    this.context.node.synchronizer.on('onFetched', (block: Block) => {
      this.context.txPool.markAsIncluded(block.body.txs)
    })
    this.context.node.blockProcessor.on('slash', challenge =>
      this.context.txPool.revert(challenge.block.header.txRoot.toString()),
    )
    this.context.node.blockProcessor.on('processed', proposal =>
      proposal.block
        ? this.context.txPool.drop(proposal.block.header.txRoot.toString())
        : undefined,
    )
    this.context.node.start()
    this.api.start()
    this.taskRunners.blockFinalize.start({
      task: this.finalizeTask.bind(this),
      interval: 10000,
    })
    this.taskRunners.massDepositCommit.start({
      task: this.commitMassDepositsIfNeeded.bind(this),
      interval: 10000,
    })
    await Promise.all([
      this.context.auctionMonitor.start(),
      this.startSubscribeFeeData(),
    ])
    this.emit('start')
  }

  async stop() {
    await Promise.all([
      this.taskRunners.blockPropose.close(),
      this.taskRunners.blockFinalize.close(),
      this.taskRunners.massDepositCommit.close(),
      this.context.node.stop(),
      this.context.auctionMonitor.stop(),
      this.api.stop(),
      this.stopGasPriceSubscription(),
    ])
    this.emit('stop')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async registerVk(
    nIn: number,
    nOut: number,
    vk: {
      vk_alpha_1: string[]
      vk_beta_2: string[][]
      vk_gamma_2: string[][]
      vk_delta_2: string[][]
      IC: string[][]
    },
  ): Promise<TransactionReceipt> {
    type Point = [BigNumberish, BigNumberish]
    const tx = await this.layer1()
      .setup.connect(this.context.account)
      .registerVk(nIn, nOut, {
        alpha1: {
          X: vk.vk_alpha_1[0],
          Y: vk.vk_alpha_1[1],
        },
        beta2: {
          X: vk.vk_beta_2[0].reverse() as Point,
          Y: vk.vk_beta_2[1].reverse() as Point,
        },
        gamma2: {
          X: vk.vk_gamma_2[0].reverse() as Point,
          Y: vk.vk_gamma_2[1].reverse() as Point,
        },
        delta2: {
          X: vk.vk_delta_2[0].reverse() as Point,
          Y: vk.vk_delta_2[1].reverse() as Point,
        },
        ic: vk.IC.map((ic: string[]) => ({ X: ic[0], Y: ic[1] })),
      })
    const receipt = tx.wait()
    return receipt
  }

  async completeSetup(): Promise<TransactionReceipt> {
    const tx = await this.layer1()
      .setup.connect(this.context.account)
      .completeSetup()
    const receipt = await tx.wait()
    return receipt
  }

  async bidAuctions(): Promise<void> {
    const consensus = await this.layer1().zkopru.consensusProvider()
    const coordinatorAddress = await this.context.account.getAddress()
    const auction = IBurnAuction__factory.connect(
      consensus,
      this.layer1().provider,
    )
    const [currentRound, url] = await Promise.all([
      auction.currentRound(),
      auction.coordinatorUrls(coordinatorAddress),
    ])
    if (+currentRound !== this.currentRound) {
      this.currentRound = +currentRound
      logger.info(
        `coordinator/coordinator.ts - Current auction round: ${currentRound}`,
      )
    }
    if (!url) {
      // Set a url
      // TODO: determine apparent external ip/port
      const urlTx = await auction
        .connect(this.context.account)
        .setUrl('http://localhost')
      await urlTx.wait()
    }
    const futureRounds = 20
    const maxPrice = parseUnits('100000', 'gwei')
    const startRound = +(await auction.currentRound()) + 3
    const promises = [] as Promise<TransactionReceipt>[]

    for (let x = startRound; x < startRound + futureRounds; x += 1) {
      const currentWinner = await auction.coordinatorForRound(x)
      if (
        currentWinner.toString().toLowerCase() ===
        coordinatorAddress.toLowerCase()
      ) {
        // Already highest bidder for this round
        // eslint-disable-next-line no-continue
        continue
      }
      const nextBid = await auction.minNextBid(x)
      if (BigNumber.from(nextBid).gt(maxPrice)) {
        // price too high
        // eslint-disable-next-line no-continue
        continue
      }
      logger.info(`coordinator/coordinator.ts - Bidding on round ${x}`)
      const tx = await auction
        .connect(this.context.account)
        ['bid(uint256)'](x, { value: nextBid })
      const receipt = tx.wait()
      promises.push(receipt)
    }
    await Promise.all(promises)
  }

  async registerAsCoordinator(): Promise<TransactionReceipt> {
    const { minimumStake } = this.layer2().config
    const consensus = await this.layer1().zkopru.consensusProvider()
    const tx = await IBurnAuction__factory.connect(
      consensus,
      this.context.account,
    ).register({ value: minimumStake })
    const receipt = await tx.wait()
    return receipt
  }

  async deregister(): Promise<TransactionReceipt> {
    const tx = await this.layer1()
      .coordinator.connect(this.context.account)
      .deregister()
    const receipt = await tx.wait()
    return receipt
  }

  private async proposeTask() {
    if (this.proposeLock.isBusy('propose')) return
    await this.proposeLock.acquire('propose', async () => {
      logger.trace(`coordinator/coordinator.ts - try to propose a new block`)
      if (!this.context.effectiveGasPrice) {
        logger.trace(
          'coordinator/coordinator.ts - Skip gen block. Gas price is not synced yet',
        )
        return
      }
      if (!this.context.node.synchronizer.isSynced()) {
        logger.trace(
          `coordinator/coordinator.ts - Skip gen block. Syncing layer 2 with the layer 1 - status: ${this.context.node.synchronizer.status}`,
        )
        return
      }
      if (this.context.auctionMonitor.isProposable) {
        await this.proposeBlock()
      } else {
        await this.forwardTxs()
      }
    })
  }

  private async proposeBlock() {
    let block: Block
    try {
      block = await this.middlewares.generator.genBlock()
    } catch (err) {
      logger.warn(`coordinator/coordinator.ts - Failed to gen block: ${err}`)
      return
    }
    try {
      const receipt = await this.middlewares.proposer.propose(block)
      if (receipt?.status) {
        await this.context.node.synchronizer.updateStatus()
      }
    } catch (err) {
      logger.error(
        `coordinator/coordinator.ts - Error occurred during block proposing: ${(err as any).toString()}`,
      )
    }
  }

  private async forwardTxs() {
    const { auctionMonitor } = this.context
    logger.info(
      `coordinator/coordinator.ts - Skipping block proposal: Not proposable`,
    )
    // get pending tx and forward to active proposer
    const pendingTx = await this.context.txPool.pickTxs(
      Infinity,
      BigNumber.from(1),
    )
    if (!pendingTx?.length) return
    const url = await auctionMonitor.functionalCoordinatorUrl(
      auctionMonitor.currentProposer,
    )
    if (!url) {
      logger.warn(
        'coordinator/coordinator.ts - No functional url to forward pending tx!',
      )
      return
    }
    for (const tx of pendingTx) {
      // forward
      await fetch(`${url}/tx`, {
        method: 'post',
        body: tx.encode().toString('hex'),
      })
    }
  }

  async commitMassDepositsIfNeeded(): Promise<TransactionReceipt | void> {
    // if pending deposit fee + pending mass deposit fee + pending tx fee > block proposal fee
    // then commit the pending deposits to prepare to propose a block
    if (!this.context.auctionMonitor.isProposable) {
      logger.info(
        'coordinator/coordinator.ts - Skipping mass deposit commit, cannot propose',
      )
      return
    }
    if (!this.context.effectiveGasPrice) {
      logger.info(
        'coordinator/coordinator.ts - Skipping deposit commit, gas price is not synced',
      )
      return
    }
    if (!this.context.node.synchronizer.isSynced()) {
      logger.info(
        'coordinator/coordinator.ts - Skipping deposit commit, chain is not synced',
      )
      return
    }
    // TODO: take staged fees from db for reorg protection
    const stagedDeposits = await this.layer1().zkopru.stagedDeposits()
    if (+stagedDeposits.fee === 0) return
    const block = await this.middlewares.generator.genBlock()
    const bytes = Buffer.concat([
      serializeHeader(block.header),
      serializeBody(block.body),
    ])
    const expectedGas = (
      await this.layer1()
        .coordinator.connect(this.context.account)
        .estimateGas.propose(`0x${bytes.toString('hex')}`)
    ).add(MAX_MASS_DEPOSIT_COMMIT_GAS)
    const expectedCost = this.context.effectiveGasPrice.mul(expectedGas)
    logger.info(
      `coordinator/coordinator.ts - Skipping mass deposit, need ${expectedCost.toString()} have ${block.header.fee
        .toBigNumber()
        .add(stagedDeposits.fee)
        .toString()}`,
    )
    if (
      expectedCost.lte(block.header.fee.toBigNumber().add(stagedDeposits.fee))
    ) {
      // pending deposits will be enough for a new block, so commit
      const tx = await this.layer1()
        .coordinator.connect(this.context.account)
        .commitMassDeposit()
      const receipt = await tx.wait()
      return receipt
    }
  }

  async commitMassDeposits(): Promise<TransactionReceipt | undefined> {
    const stagedDeposits = await this.layer1().zkopru.stagedDeposits()
    if (stagedDeposits.fee.gt(0)) {
      const tx = await this.layer1()
        .coordinator.connect(this.context.account)
        .commitMassDeposit()
      const receipt = await tx.wait()
      return receipt
    }
    return undefined
  }

  private async finalizeTask() {
    if (!this.context.node.synchronizer.isSynced()) {
      logger.info(
        'coordinator/coordinator.ts - Skipping finalization, chain is not synced',
      )
      return
    }
    const finalization = await this.genFinalization()
    if (!finalization) return
    logger.info('coordinator/coordinator.ts - finalization')
    const blockHash = headerHash(finalization.header).toString()
    let finalizable = false
    try {
      await this.layer1()
        .coordinator.connect(this.context.account)
        .callStatic.finalize(
          `0x${serializeFinalization(finalization).toString('hex')}`,
        )
      finalizable = true
    } catch (err) {
      if (err instanceof Error)
        logger.error(
          `coordinator/coordinator.ts - error occured during finalizeTask(): ${err.toString()}`,
        )
      return
    }
    if (finalizable) {
      try {
        const tx = await this.layer1()
          .coordinator.connect(this.context.account)
          .finalize(`0x${serializeFinalization(finalization).toString('hex')}`)
        const receipt = await tx.wait()
        if (receipt) {
          await this.layer2().db.update('Proposal', {
            where: { hash: blockHash },
            update: { finalized: true },
          })
          logger.info(
            `coordinator/coordinator.ts - finalized block ${blockHash}`,
          )
        } else {
          logger.warn(
            `coordinator/coordinator.ts - Failed to finalize the block ${blockHash}`,
          )
        }
      } catch (err) {
        if (err instanceof Error) logger.error(err)
      }
    }
  }

  private async genFinalization(): Promise<Finalization | undefined> {
    const latest = await this.layer1().zkopru.latest()
    const currentBlockNumber: number = await this.layer1().provider.getBlockNumber()
    const l1Config = await this.layer1().getConfig()
    const blocks = await this.layer2().db.findMany('Header', {
      where: {
        parentBlock: latest,
      },
    })
    const blockHashes = blocks.map(({ hash }) => hash)
    const unfinalizedProposals = await this.layer2().db.findMany('Proposal', {
      where: {
        hash: blockHashes,
        finalized: null,
        verified: true,
        isUncle: null,
        proposalData: { ne: null },
        proposedAt: {
          lt: currentBlockNumber - l1Config.challengePeriod,
        },
      },
      limit: 1,
    })
    const proposalToFinalize = unfinalizedProposals[0]
    if (!proposalToFinalize) return undefined
    assert(proposalToFinalize.proposalData)

    const tx = JSON.parse(proposalToFinalize.proposalData)
    const block = Block.fromTx(tx, true)

    const finalization: Finalization = block.getFinalization()
    logger.trace(`coordinator/coordinator.ts - latest: ${latest}`)
    logger.trace(
      `coordinator/coordinator.ts - finalization block: ${block.hash.toString()}`,
    )
    logger.trace(
      `coordinator/coordinator.ts - header deposit root: ${finalization.header.depositRoot.toString()}`,
    )
    logger.trace(
      `coordinator/coordinator.ts - calculated root: ${root(
        finalization.massDeposits.map(massDepositHash),
      )}`,
    )
    return finalization
  }

  private async startSubscribeFeeData() {
    const listeners = this.layer1().provider.listeners('block')
    if (!listeners.find(l => l === this.gasHandler)) {
      // the term 'effectiveGasPrice' is in EIP-1559 specification
      // means that sum of 'priority_fee_per_gas' and 'block.base_fee_per_gas'
      const { maxFeePerGas } = await this.layer1().provider.getFeeData()
      if (maxFeePerGas) {
        this.context.effectiveGasPrice = Fp.from(maxFeePerGas)
      } else {
        logger.warn(`coordinator/coordinator.ts - could not receive feeData`)
        this.context.effectiveGasPrice = Fp.from(1)
      }
      this.layer1().provider.on('block', () => this.gasHandler())
    }
  }

  private async stopGasPriceSubscription() {
    this.layer1().provider.off('block', this.gasHandler)
  }

  private gasHandler = async () => {
    const block = await this.layer1().provider.getBlock('latest')

    let maxFeePerGas: BigNumber | undefined

    if (block && block.baseFeePerGas) {
      const maxPriorityFeePerGas = BigNumber.from(
        this.context.config.maxPriorityFeePerGas ?? '2500000000',
      )
      maxFeePerGas = block.baseFeePerGas.mul(2).add(maxPriorityFeePerGas)
    }

    if (maxFeePerGas) {
      this.context.effectiveGasPrice = Fp.from(maxFeePerGas)
    } else {
      logger.warn(
        `coordinator/coordinator.ts - gasHandler could not update effectiveGasPrice`,
      )
    }
  }
}
