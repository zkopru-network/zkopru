import { ZkAccount } from '@zkopru/account'
import { WebsocketProvider, IpcProvider, Account } from 'web3-core'
import Web3 from 'web3'
import { verifyProof } from '@zkopru/tree'
import { DB, BlockCache } from '@zkopru/database'
import { Bytes32 } from 'soltypes'
import { logger } from '@zkopru/utils'
import { L1Contract } from '../../context/layer1'
import { L2Chain } from '../../context/layer2'
import { BootstrapHelper } from '../bootstrap'
import { Block, headerHash } from '../../block'
import { Synchronizer } from '../synchronizer'
import { ZkopruNode } from '../zkopru-node'
import { BlockProcessor } from '../block-processor'
import { Tracker } from '../tracker'
import { LightValidator } from './lightnode-validator'
import { Watchdog } from '../watchdog'

type provider = WebsocketProvider | IpcProvider

export class LightNode extends ZkopruNode {
  constructor({
    db,
    blockCache,
    l1Contract,
    l2Chain,
    synchronizer,
    tracker,
    watchdog,
    blockProcessor,
    bootstrapHelper,
  }: {
    db: DB
    blockCache: BlockCache
    l1Contract: L1Contract
    l2Chain: L2Chain
    bootstrapHelper: BootstrapHelper
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
      bootstrapHelper,
    })
  }

  async start() {
    await this.bootstrap()
    super.start()
  }

  async bootstrap() {
    if (!this.bootstrapHelper) return
    const latest = await this.layer1.upstream.methods.latest().call()
    const latestBlockFromDB = await this.layer2.getBlock(Bytes32.from(latest))
    if (latestBlockFromDB && latestBlockFromDB.verified) {
      return
    }
    const bootstrapData = await this.bootstrapHelper.fetchBootstrapData(latest)
    if (!bootstrapData.proposal.proposalTx) {
      logger.error('bootstrap api is not giving proposalTx')
      return
    }
    const proposalData = await this.layer1.web3.eth.getTransaction(
      bootstrapData.proposal.proposalTx,
    )
    // console.log('bootstrap should give proposal num and etc', proposalData)
    const block = Block.fromTx(proposalData)
    const headerProof = headerHash(block.header).eq(Bytes32.from(latest))
    const utxoMerkleProof = verifyProof(
      this.layer2.grove.config.utxoHasher,
      bootstrapData.utxoStartingLeafProof,
    )
    const withdrawalMerkleProof = verifyProof(
      this.layer2.grove.config.withdrawalHasher,
      bootstrapData.withdrawalStartingLeafProof,
    )
    if (headerProof && utxoMerkleProof && withdrawalMerkleProof) {
      await this.layer2.applyBootstrap(block, bootstrapData)
    }
  }

  static async new({
    provider,
    address,
    db,
    accounts,
    slasher,
    bootstrapHelper,
  }: {
    provider: provider
    address: string
    db: DB
    slasher?: Account
    accounts?: ZkAccount[]
    bootstrapHelper: BootstrapHelper
  }): Promise<LightNode> {
    if (!provider.connected) throw Error('provider is not connected')
    if (!bootstrapHelper)
      throw Error('You need bootstrap node to run light node')
    const web3: Web3 = new Web3(provider)
    // Add zk account to the web3 object if it exists
    const tracker = new Tracker(db)
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
    const validator = new LightValidator(l1Contract, l2Chain)
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
    const node = new LightNode({
      db,
      blockCache,
      l1Contract,
      l2Chain,
      synchronizer,
      tracker,
      watchdog,
      bootstrapHelper,
      blockProcessor,
      accounts,
    })
    return node
  }
}
