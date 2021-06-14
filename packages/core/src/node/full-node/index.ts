import { ZkAccount } from '@zkopru/account'
import { WebsocketProvider, IpcProvider, Account } from 'web3-core'
import { DB, BlockCache } from '@zkopru/database'
import Web3 from 'web3'
import { L1Contract } from '../../context/layer1'
import { L2Chain } from '../../context/layer2'
import { Synchronizer } from '../synchronizer'
import { ZkopruNode } from '../zkopru-node'
import { Tracker } from '../tracker'
import { FullValidator } from './fullnode-validator'
import { BlockProcessor } from '../block-processor'
import { Watchdog } from '../watchdog'

type provider = WebsocketProvider | IpcProvider

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
    provider: provider
    address: string
    db: DB
    slasher?: Account
    accounts?: ZkAccount[]
  }): Promise<FullNode> {
    if (!provider.connected) throw Error('provider is not connected')
    const web3: Web3 = new Web3(provider)
    const tracker = new Tracker(db)
    // Add zk account to the web3 object if it exists
    if (accounts) {
      await tracker.addAccounts(...accounts)
      for (const account of accounts) {
        web3.eth.accounts.wallet.add(account.toAddAccount())
      }
    }
    const l1Contract = new L1Contract(web3, address)
    // retrieve l2 chain from database
    const networkId = await web3.eth.net.getId()
    const chainId = await web3.eth.getChainId()
    const l2Chain: L2Chain = await ZkopruNode.initLayer2(
      db,
      l1Contract,
      networkId,
      chainId,
      address,
      accounts,
    )
    const validator = new FullValidator(l1Contract, l2Chain)
    const blockCache = new BlockCache(web3, db)
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
