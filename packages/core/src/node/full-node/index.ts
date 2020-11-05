import { ZkAccount } from '@zkopru/account'
import { WebsocketProvider, IpcProvider } from 'web3-core'
import { DB } from '@zkopru/prisma'
import Web3 from 'web3'
import { L1Contract } from '../../context/layer1'
import { L2Chain } from '../../context/layer2'
import { Synchronizer } from '../synchronizer'
import { ZkopruNode } from '../zkopru-node'
import { Tracker } from '../tracker'
import { FullValidator } from './fullnode-validator'
import { BlockProcessor } from '../block-processor'

type provider = WebsocketProvider | IpcProvider

export class FullNode extends ZkopruNode {
  constructor({
    db,
    l1Contract,
    l2Chain,
    synchronizer,
    tracker,
    blockProcessor,
  }: {
    db: DB
    l1Contract: L1Contract
    l2Chain: L2Chain
    synchronizer: Synchronizer
    tracker: Tracker
    blockProcessor: BlockProcessor
    accounts?: ZkAccount[]
  }) {
    super({
      db,
      l1Contract,
      l2Chain,
      synchronizer,
      blockProcessor,
      tracker,
    })
  }

  static async new({
    provider,
    address,
    db,
    accounts,
  }: {
    provider: provider
    address: string
    db: DB
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
    const blockProcessor = new BlockProcessor({
      db,
      validator,
      l2Chain,
      tracker,
    })
    // If the chain needs bootstraping, fetch bootstrap data and apply
    const synchronizer = new Synchronizer(db, l1Contract)
    return new FullNode({
      db,
      l1Contract,
      l2Chain,
      synchronizer,
      tracker,
      blockProcessor,
      accounts,
    })
  }
}
