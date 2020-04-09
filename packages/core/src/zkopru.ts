import { ZkAccount } from '@zkopru/account'
import { provider } from 'web3-core'
import { InanoSQLInstance } from '@nano-sql/core'
import Web3 from 'web3'
import { Layer1 } from './layer1'
import { Verifier } from './verifier'
import { Layer2, NodeType } from './layer2'
import { BootstrapData, BootstrapNode } from './bootstrap'
import { Block } from './block'
import { Challenge } from './challenge'

export enum Status {
  NOT_INITIALIZED,
  ON_SYNCING,
  LIVE,
  ON_ERROR,
}

export interface ZkOPRUOption {
  nodeType: NodeType
  verify: boolean
}

export class ZkOPRU {
  layer1!: Layer1

  layer2!: Layer2

  verifier?: Verifier

  account?: ZkAccount

  status!: Status

  option!: ZkOPRUOption

  static async new({
    provider,
    address,
    db,
    account,
    bootstrapNode,
    option,
  }: {
    provider: provider
    address: string
    db: InanoSQLInstance
    account?: ZkAccount
    bootstrapNode?: BootstrapNode
    option?: ZkOPRUOption
  }): Promise<ZkOPRU> {
    const zkopru = new ZkOPRU()
    zkopru.option = option || {
      nodeType: NodeType.LIGHT_NODE,
      verify: false,
    }
    await zkopru.init({ provider, address, db, account, bootstrapNode })
    return zkopru
  }

  async init({
    provider,
    address,
    db,
    account,
    bootstrapNode,
  }: {
    provider: provider
    address: string
    db: InanoSQLInstance
    account?: ZkAccount
    bootstrapNode?: BootstrapNode
  }) {
    if (this.option.nodeType === NodeType.LIGHT_NODE && this.option.verify) {
      throw Error('Only Full node can process verifications')
    }
    const web3: Web3 = new Web3(provider)
    // Add zk account to the web3 object if it exists
    if (account) {
      web3.eth.accounts.wallet.add(account.toAddAccount())
    }
    const layer1 = new Layer1(web3, address)
    // retrieve l2 chain from database
    const netId = await web3.eth.net.getId()
    const chainId = await web3.eth.getChainId()
    let layer2 = await Layer2.with(db, netId, chainId, address)
    // if there is no existing l2 chain, create new one
    if (!layer2) {
      let vks = {}
      if (this.option.verify) {
        vks = await layer1.getVKs()
      }
      const config = await layer1.getConfig()
      layer2 = new Layer2(db, this.option.nodeType, config, vks)
    }
    // If the chain needs bootstraping, fetch bootstrap data and apply
    if (await layer2.needBootstrapping()) {
      let bootstrapData: BootstrapData | undefined
      if (bootstrapNode) {
        bootstrapData = await bootstrapNode.fetchBootstrapData()
      }
      await layer2.bootstrap(bootstrapData)
    }
    this.layer1 = layer1
    this.layer2 = layer2
    this.account = account
    this.status = Status.NOT_INITIALIZED
  }

  async fetchBlocks(from: number) {
    this.layer1.fetchBlocks(from, this.onBlock)
  }

  private async onBlock(block: Block) {
    if (this.option.verify) {
      await this.layer2.verify(block, this.onChallenge)
    }
    await this.layer2.apply(block)
  }

  private async onChallenge(challenge: Challenge) {
    console.log(challenge, this)
    // RUN challenge
  }

  // configure db nanoSQL
  // web3 provider
  // zk account - wallet: configure zk account
  //
  // init zkopru
  // bootstrap zkopru - wallet only: get bootstrap data from coordinator
  // start synchronizer => will update status & apply(layer2 data)
  // stop synchronizer
  // network status
  // verifier on => will emit data for challenge
  // verifier off
  // addAccounts
  // setAccount
  // getDataForBlockProposing
  // getDataForTxBuilding
  // this.synchronizer = new Synchronizer({
  // })
}
