/* eslint-disable @typescript-eslint/camelcase */
import { ZkAccount } from '@zkopru/account'
import { DB, BlockCache, ERC20Info } from '@zkopru/database'
import { Grove, poseidonHasher, keccakHasher } from '@zkopru/tree'
import { logger } from '@zkopru/utils'
import { Layer1 } from '@zkopru/contracts'
import { Bytes20 } from 'soltypes'
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
    logger.trace('core/zkopru-node - ZkopruNode::start()')
    if (!this.running) {
      this.running = true
      logger.info('core/zkopru-node - Node starts')
      this.synchronizer.sync(
        this.tracker.transferTrackers.map(viewer => viewer.zkAddress),
      )
      this.blockProcessor.start()
      this.blockProcessor.on('slash', async slash => {
        const result = await this.watchdog?.slash(slash.tx)
        logger.info(
          `core/zkopru-node - Found a slashable proposal. Execution result is ${result}`,
        )
      })
      this.blockProcessor.on('processed', async proposal => {
        this.synchronizer.setLatestProcessed(proposal.proposalNum)
      })
    } else {
      logger.info(`core/zkopru-node - Node is already running`)
    }
  }

  async stop() {
    logger.trace('core/zkopru-node - ZkopruNode::stop()')
    if (this.running) {
      logger.info('core/zkopru-node - Node stops')
      this.running = false
      this.blockProcessor.removeAllListeners()
      await Promise.all([this.synchronizer.stop(), this.blockProcessor.stop()])
    } else {
      logger.info(`core/zkopru-node - Node is already stopped`)
    }
  }

  async loadERC20InfoByAddress(addresses: string[]): Promise<ERC20Info[]> {
    if (!addresses.length) return []
    const registry = await this.layer2.getTokenRegistry()
    // this is going to thrash the lock a bit, ideally batch the queries
    // probably not worth rewriting until performance becomes a problem
    const promises = [addresses].flat().map(async address => {
      const index = registry.erc20s.findIndex(addr => {
        return addr.eq(Bytes20.from(address))
      })
      if (index === -1) {
        throw new Error(`Unregisterd ERC20 address: ${address}`)
      }
      const info = await this.db.findOne('ERC20Info', {
        where: {
          address,
        },
      })
      if (!info) {
        // load the data and store it
        const contract = Layer1.getERC20(this.layer1.web3, address)
        const [symbol, decimals] = await Promise.all([
          contract.methods.symbol().call(),
          contract.methods.decimals().call(),
        ])
        await this.db.upsert('ERC20Info', {
          where: { address },
          create: {
            address,
            symbol,
            decimals: +decimals,
          },
          update: {
            symbol,
            decimals: +decimals,
          },
        })
        return {
          address,
          symbol,
          decimals: +decimals,
        }
      }
      return info
    })
    return Promise.all(promises)
  }

  async loadERC20Info(): Promise<ERC20Info[]> {
    logger.trace('core/zkopru-node - ZkopruNode::loadERC20Info()')
    const registry = await this.layer2.getTokenRegistry()
    const existingInfo = await this.db.findMany('ERC20Info', {
      where: {
        address: registry.erc20s.map(({ val }) => val),
      },
    })
    for (const token of registry.erc20s) {
      const address = token.val
      // eslint-disable-next-line no-continue
      if (existingInfo.indexOf(address) !== -1) continue
      // otherwise load the token info
      const contract = Layer1.getERC20(this.layer1.web3, address)
      const [symbol, decimals] = await Promise.all([
        contract.methods.symbol().call(),
        contract.methods.decimals().call(),
      ])
      logger.info(`core/zkopru-node - Register ${symbol} to the token registry`)
      await this.db.upsert('ERC20Info', {
        where: { address },
        create: {
          address,
          symbol,
          decimals: +decimals,
        },
        update: {
          symbol,
          decimals: +decimals,
        },
      })
    }
    return this.db.findMany('ERC20Info', {
      where: {
        address: registry.erc20s.map(({ val }) => val),
      },
    })
  }

  static async initLayer2(
    db: DB,
    l1Contract: L1Contract,
    networkId: number,
    chainId: number,
    address: string,
    accounts?: ZkAccount[],
  ): Promise<L2Chain> {
    logger.trace('core/zkopru-node - ZkopruNode::initLayer2()')
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
    logger.info(`core/zkopru-node - Layer2 blockchain is ready`)
    return new L2Chain(db, grove, config, vks)
  }
}
