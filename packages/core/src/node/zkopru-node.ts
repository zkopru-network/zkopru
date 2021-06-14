/* eslint-disable @typescript-eslint/camelcase */
import { ZkAccount } from '@zkopru/account'
import { DB, BlockCache } from '@zkopru/database'
import { Grove, poseidonHasher, keccakHasher } from '@zkopru/tree'
import { logger } from '@zkopru/utils'
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

  blockCache: BlockCache

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
    blockCache,
    l1Contract,
    l2Chain,
    synchronizer,
    tracker,
    blockProcessor,
    watchdog,
    bootstrapHelper,
  }: {
    db: DB
    blockCache: BlockCache
    l1Contract: L1Contract
    l2Chain: L2Chain
    synchronizer: Synchronizer
    tracker: Tracker
    watchdog?: Watchdog
    blockProcessor: BlockProcessor
    bootstrapHelper?: BootstrapHelper
  }) {
    this.db = db
    this.blockCache = blockCache
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
    this.watchdog = watchdog
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
      this.blockProcessor.on('slash', async slash => {
        const result = await this.watchdog?.slash(slash.tx)
        logger.info(`slash result: ${result}`)
      })
      this.blockProcessor.on('processed', async proposal => {
        this.synchronizer.setLatestProcessed(proposal.proposalNum)
      })
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

    const savedConfig = await db.findOne('Config', {
      where: {
        networkId,
        chainId,
        address,
      },
    })
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
