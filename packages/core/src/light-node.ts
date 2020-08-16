import { ZkAccount } from '@zkopru/account'
import { WebsocketProvider, IpcProvider } from 'web3-core'
import Web3 from 'web3'
import { verifyProof } from '@zkopru/tree'
import { DB } from '@zkopru/prisma'
import { Bytes32 } from 'soltypes'
import { logger } from '@zkopru/utils'
import { L1Contract } from './layer1'
import { Verifier, VerifyOption } from './verifier'
import { L2Chain } from './layer2'
import { BootstrapHelper } from './bootstrap'
import { Block, headerHash } from './block'
import { Synchronizer } from './synchronizer'
import { ZkOPRUNode } from './zkopru-node'

type provider = WebsocketProvider | IpcProvider

export class LightNode extends ZkOPRUNode {
  constructor({
    db,
    l1Contract,
    l2Chain,
    verifier,
    synchronizer,
    bootstrapHelper,
    accounts,
    verifyOption,
  }: {
    db: DB
    l1Contract: L1Contract
    l2Chain: L2Chain
    verifier: Verifier
    bootstrapHelper: BootstrapHelper
    synchronizer: Synchronizer
    accounts: ZkAccount[]
    verifyOption: VerifyOption
  }) {
    super({
      db,
      l1Contract,
      l2Chain,
      verifier,
      synchronizer,
      bootstrapHelper,
      accounts,
      verifyOption,
    })
    if (verifyOption.nullifierRollUp) {
      throw Error('Light node cannot process nullifier verifications')
    }
  }

  async startSync() {
    await this.bootstrap()
    super.startSync()
  }

  async bootstrap() {
    if (!this.bootstrapHelper) return
    const latest = await this.l1Contract.upstream.methods.latest().call()
    const latestBlockFromDB = await this.l2Chain.getBlock(Bytes32.from(latest))
    if (latestBlockFromDB && latestBlockFromDB.verified) {
      return
    }
    const bootstrapData = await this.bootstrapHelper.fetchBootstrapData(latest)
    if (!bootstrapData.proposal.proposalTx) {
      logger.error('bootstrap api is not giving proposalTx')
      return
    }
    const proposalData = await this.l1Contract.web3.eth.getTransaction(
      bootstrapData.proposal.proposalTx,
    )
    // console.log('bootstrap should give proposal num and etc', proposalData)
    const block = Block.fromTx(proposalData)
    const headerProof = headerHash(block.header).eq(Bytes32.from(latest))
    const utxoMerkleProof = verifyProof(
      this.l2Chain.grove.config.utxoHasher,
      bootstrapData.utxoStartingLeafProof,
    )
    const withdrawalMerkleProof = verifyProof(
      this.l2Chain.grove.config.withdrawalHasher,
      bootstrapData.withdrawalStartingLeafProof,
    )
    if (headerProof && utxoMerkleProof && withdrawalMerkleProof) {
      await this.l2Chain.applyBootstrap(block, bootstrapData)
    }
  }

  static async new({
    provider,
    address,
    db,
    accounts,
    bootstrapHelper,
    option,
  }: {
    provider: provider
    address: string
    db: DB
    accounts: ZkAccount[]
    bootstrapHelper: BootstrapHelper
    option?: VerifyOption
  }): Promise<LightNode> {
    if (!provider.connected) throw Error('provider is not connected')
    const verifyOption = option || {
      header: true,
      deposit: true,
      migration: true,
      outputRollUp: true,
      withdrawalRollUp: true,
      nullifierRollUp: false,
      snark: false,
    }
    if (!bootstrapHelper)
      throw Error('You need bootstrap node to run light node')
    const web3: Web3 = new Web3(provider)
    // Add zk account to the web3 object if it exists
    if (accounts) {
      for (const account of accounts) {
        web3.eth.accounts.wallet.add(account.toAddAccount())
      }
    }
    const l1Contract = new L1Contract(web3, address)
    // retrieve l2 chain from database
    const networkId = await web3.eth.net.getId()
    const chainId = await web3.eth.getChainId()
    const l2Chain: L2Chain = await ZkOPRUNode.getOrInitChain(
      db,
      l1Contract,
      networkId,
      chainId,
      address,
      accounts,
    )
    let vks = {}
    if (verifyOption.snark) {
      vks = await l1Contract.getVKs()
    }
    const verifier = new Verifier(verifyOption, vks)
    // If the chain needs bootstraping, fetch bootstrap data and apply
    const synchronizer = new Synchronizer(db, l1Contract)
    return new LightNode({
      db,
      l1Contract,
      l2Chain,
      verifier,
      synchronizer,
      bootstrapHelper,
      accounts,
      verifyOption,
    })
  }
}
