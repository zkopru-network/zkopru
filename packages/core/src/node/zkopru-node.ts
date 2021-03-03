/* eslint-disable @typescript-eslint/camelcase */
import { ZkAccount } from '@zkopru/account'
import { DB } from '@zkopru/database'
import { Grove, poseidonHasher, keccakHasher } from '@zkopru/tree'
import { logger } from '@zkopru/utils'
import { L1Contract } from '../context/layer1'
import { L2Chain } from '../context/layer2'
import { BootstrapHelper } from './bootstrap'
import { Synchronizer, NetworkStatus } from './synchronizer'
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
    watchdog,
    bootstrapHelper,
  }: {
    db: DB
    l1Contract: L1Contract
    l2Chain: L2Chain
    synchronizer: Synchronizer
    tracker: Tracker
    watchdog?: Watchdog
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
        if (this.synchronizer.status === NetworkStatus.FULLY_SYNCED) {
          await this.calcCanonicalBlockHeights()
        }
      })
      this.synchronizer.on('status', async status => {
        if (status === NetworkStatus.FULLY_SYNCED) {
          await this.calcCanonicalBlockHeights()
        }
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

  // idempotently calculate canonical numbers
  private async calcCanonicalBlockHeights() {
    // find earliest block with no canonical num
    const startBlock = await this.db.findMany('Proposal', {
      where: {
        canonicalNum: null,
      },
      orderBy: { proposalNum: 'asc' },
      limit: 1,
    })
    if (startBlock.length === 0) {
      // have canonical numbers for all blocks
      return
    }
    // The proposal to start at
    const [{ proposalNum }] = startBlock
    if (proposalNum === null) {
      throw new Error('Proposal number is null')
    }
    const blockHeight = await this.db.count('Proposal', {})
    const latestProcessed = this.synchronizer.latestProcessed || 0
    for (
      let x = proposalNum;
      x < Math.min(blockHeight, latestProcessed);
      x += 1
    ) {
      this.calcCanonicalBlockHeight(x)
    }
  }

  private async calcCanonicalBlockHeight(proposalNum: number) {
    const proposals = await this.db.findMany('Proposal', {
      where: { proposalNum },
    })
    if (proposals.length !== 1) {
      throw new Error(`Did not find one proposal for number: ${proposalNum}`)
    }
    const [proposal] = proposals
    const { hash } = proposal
    if (proposalNum === 0) {
      await this.db.update('Proposal', {
        where: { hash },
        update: { canonicalNum: 0 },
      })
      // eslint-disable-next-line no-continue
      return
    }
    const header = await this.db.findOne('Header', {
      where: { hash },
    })
    if (!header) {
      throw new Error(`Unable to find header for proposal ${proposal.hash}`)
    }
    const parent = await this.db.read(prisma =>
      prisma.proposal.findOne({
        where: { hash: header.parentBlock.toString() },
      }),
    )
    if (!parent) {
      throw new Error(`Unable to find parent proposal`)
    }
    if (parent.canonicalNum === null) {
      throw new Error(`Expected canonicalNum to exist!`)
    }
    // console.log(`canonical num: ${parent.canonicalNum+1}`)
    await this.db.write(prisma =>
      prisma.proposal.update({
        where: { hash },
        data: { canonicalNum: (parent.canonicalNum as number) + 1 },
      }),
    )
  }
}
