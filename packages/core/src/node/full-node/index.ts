import { ZkAccount } from '@zkopru/account'
import { DB, BlockCache } from '@zkopru/database'
import { BaseProvider } from '@ethersproject/providers'
import { Signer } from 'ethers'
import { L1Contract } from '../../context/layer1'
import { L2Chain } from '../../context/layer2'
import { Synchronizer } from '../synchronizer'
import { ZkopruNode } from '../zkopru-node'
import { Tracker } from '../tracker'
import { FullValidator } from './fullnode-validator'
import { BlockProcessor } from '../block-processor'
import { Watchdog } from '../watchdog'

export class FullNode extends ZkopruNode {
  constructor({
    db,
    blockCache,
    l1Contract,
    l2Chain,
    synchronizer,
    tracker,
    watchdog,
    blockProcessor,
  }: {
    db: DB
    blockCache: BlockCache
    l1Contract: L1Contract
    l2Chain: L2Chain
    synchronizer: Synchronizer
    tracker: Tracker
    watchdog?: Watchdog
    blockProcessor: BlockProcessor
    accounts?: ZkAccount[]
  }) {
    super({
      db,
      blockCache,
      l1Contract,
      l2Chain,
      synchronizer,
      blockProcessor,
      tracker,
      watchdog,
    })
  }

  static async new({
    provider,
    address,
    db,
    slasher,
    accounts,
  }: {
    provider: BaseProvider
    address: string
    db: DB
    slasher?: Signer
    accounts?: ZkAccount[]
  }): Promise<FullNode> {
    const tracker = new Tracker(db)
    if (accounts) {
      await tracker.addAccounts(...accounts)
    }
    const l1Contract = new L1Contract(provider, address)
    // retrieve l2 chain from database
    const network = await provider.getNetwork()
    const networkId = network.chainId // todo
    const { chainId } = network
    const l2Chain: L2Chain = await ZkopruNode.initLayer2(
      db,
      l1Contract,
      networkId,
      chainId,
      address,
      accounts,
    )
    const validator = new FullValidator(l1Contract, l2Chain)
    const blockCache = new BlockCache(provider, db)
    const blockProcessor = new BlockProcessor({
      db,
      blockCache,
      validator,
      l2Chain,
      tracker,
    })
    // If the chain needs bootstraping, fetch bootstrap data and apply
    const synchronizer = new Synchronizer(db, l1Contract, blockCache)
    const watchdog = slasher ? new Watchdog(l1Contract, slasher) : undefined
    return new FullNode({
      db,
      blockCache,
      l1Contract,
      l2Chain,
      synchronizer,
      tracker,
      watchdog,
      blockProcessor,
      accounts,
    })
  }
}
