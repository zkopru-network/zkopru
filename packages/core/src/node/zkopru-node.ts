/* eslint-disable @typescript-eslint/camelcase */
import { ZkAccount } from '@zkopru/account'
import { DB } from '@zkopru/prisma'
import { Grove, poseidonHasher, keccakHasher } from '@zkopru/tree'
import { logger } from '@zkopru/utils'
import { Bytes32 } from 'soltypes'
import { L1Contract } from '../context/layer1'
import { L2Chain } from '../context/layer2'
import { BootstrapHelper } from './bootstrap'
import { Synchronizer } from './synchronizer'
import { Tracker } from './tracker'
import { BlockProcessor } from './block-processor'
import { Watchdog } from './watchdog'

export class ZkopruNode {
  running: boolean

  db: DB

  tracker: Tracker

  private context: {
    layer1: L1Contract
    layer2: L2Chain
  }

  layer1: L1Contract

  layer2: L2Chain

  blockProcessor: BlockProcessor

  synchronizer: Synchronizer

  watchdog?: Watchdog

  bootstrapHelper?: BootstrapHelper

  constructor({
    db,
    l1Contract,
    l2Chain,
    synchronizer,
    tracker,
    blockProcessor,
    bootstrapHelper,
  }: {
    db: DB
    l1Contract: L1Contract
    l2Chain: L2Chain
    synchronizer: Synchronizer
    tracker: Tracker
    blockProcessor: BlockProcessor
    bootstrapHelper?: BootstrapHelper
  }) {
    this.db = db
    this.tracker = tracker
    this.context = {
      layer1: l1Contract,
      layer2: l2Chain,
    }
    this.layer1 = this.context.layer1
    this.layer2 = this.context.layer2
    this.synchronizer = synchronizer
    this.running = false
    this.blockProcessor = blockProcessor
    this.bootstrapHelper = bootstrapHelper
  }

  isRunning(): boolean {
    return this.running
  }

  start() {
    if (!this.running) {
      this.running = true
      logger.info('start sync')
      this.synchronizer.sync()
      this.blockProcessor.start()
      this.blockProcessor.on('slash', slash => this.watchdog?.slash(slash))
      this.blockProcessor.on('processed', proposalNum =>
        this.synchronizer.setLatestProcessed(proposalNum),
      )
    } else {
      logger.info('already on syncing')
    }
  }

  async stop() {
    if (this.running) {
      logger.info('stop sync')
      this.running = false
      this.blockProcessor.removeAllListeners()
      await Promise.all([this.synchronizer.stop(), this.blockProcessor.stop()])
    } else {
      logger.info('already stopped')
    }
  }

  async latestBlock(): Promise<Bytes32> {
    const lastVerifiedProposal = (
      await this.db.read(prisma =>
        prisma.proposal.findMany({
          where: {
            AND: [{ verified: true }, { isUncle: null }],
          },
          orderBy: { proposalNum: 'desc' },
          include: { block: { include: { header: true } } },
          take: 1,
        }),
      )
    ).pop()
    if (!lastVerifiedProposal) throw Error('no verified proposal')
    return Bytes32.from(lastVerifiedProposal.hash)
  }

  static async initLayer2(
    db: DB,
    l1Contract: L1Contract,
    networkId: number,
    chainId: number,
    address: string,
    accounts?: ZkAccount[],
  ): Promise<L2Chain> {
    logger.info('Get or init chain')
    const zkAddressesToObserve = accounts
      ? accounts.map(account => account.zkAddress)
      : []
    const addressesToObserve = accounts
      ? accounts.map(account => account.ethAddress)
      : []

    const savedConfig = await db.read(prisma =>
      prisma.config.findOne({
        where: {
          networkId_chainId_address: {
            networkId,
            chainId,
            address,
          },
        },
      }),
    )
    const config = savedConfig || (await l1Contract.getConfig())
    const vks = await l1Contract.getVKs()
    // l1Contract.upstream.
    const hashers = {
      utxo: poseidonHasher(config.utxoTreeDepth),
      withdrawal: keccakHasher(config.withdrawalTreeDepth),
      nullifier: keccakHasher(config.nullifierTreeDepth),
    }
    const grove = new Grove(db, {
      ...config,
      utxoHasher: hashers.utxo,
      withdrawalHasher: hashers.withdrawal,
      nullifierHasher: hashers.nullifier,
      fullSync: true,
      forceUpdate: false,
      zkAddressesToObserve,
      addressesToObserve,
    })
    await grove.init()
    return new L2Chain(db, grove, config, vks)
  }
}
