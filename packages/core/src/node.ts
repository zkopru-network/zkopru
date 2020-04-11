import { ZkAccount } from '@zkopru/account'
import { WebsocketProvider, IpcProvider } from 'web3-core'
import { InanoSQLInstance } from '@nano-sql/core'
import { uuid } from '@nano-sql/core/lib/utilities'
import Web3 from 'web3'
import { ChainConfig, NodeType, schema } from '@zkopru/database'
import { Grove, poseidonHasher, keccakHasher } from '@zkopru/tree'
import { L1Contract } from './layer1'
import { Verifier, VerifyOption, VerifyResult } from './verifier'
import { L2Chain } from './layer2'
import { BootstrapData, BootstrapNode } from './bootstrap'
import { BlockStatus, headerHash } from './block'
import { Challenge } from './challenge'
import { Synchronizer } from './synchronizer'
import { genesis } from './genesis'

type provider = WebsocketProvider | IpcProvider

export enum Status {
  STOPPED,
  ON_SYNCING,
  LIVE,
  ON_ERROR,
}

export interface NodeConfiguration {
  nodeType: NodeType
  verifyOption: VerifyOption
}

export class Node {
  l1Contract: L1Contract

  l2Chain: L2Chain

  verifier: Verifier

  synchronizer: Synchronizer

  account: ZkAccount | undefined

  status: Status

  config: NodeConfiguration

  constructor({
    l1Contract,
    l2Chain,
    verifier,
    synchronizer,
    account,
    config,
  }: {
    l1Contract: L1Contract
    l2Chain: L2Chain
    verifier: Verifier
    synchronizer: Synchronizer
    account?: ZkAccount
    config: NodeConfiguration
  }) {
    if (config.nodeType === NodeType.LIGHT_NODE && config.verifyOption) {
      throw Error('Only Full node can process verifications')
    }
    this.l1Contract = l1Contract
    this.l2Chain = l2Chain
    this.verifier = verifier
    this.synchronizer = synchronizer
    this.account = account
    this.config = config
    this.status = Status.STOPPED
  }

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
    option?: NodeConfiguration
  }): Promise<Node> {
    const nodeConfig = option || {
      nodeType: NodeType.LIGHT_NODE,
      verifyOption: {
        header: true,
        deposit: true,
        migration: true,
        outputRollUp: true,
        withdrawalRollUp: true,
        nullifierRollUp: false,
        snark: false,
      },
    }
    const web3: Web3 = new Web3(provider)
    // Add zk account to the web3 object if it exists
    if (account) {
      web3.eth.accounts.wallet.add(account.toAddAccount())
    }
    const l1Contract = new L1Contract(web3, address)
    // retrieve l2 chain from database
    const networkId = await web3.eth.net.getId()
    const chainId = await web3.eth.getChainId()
    let l2Chain: L2Chain
    const l2ChainFromDB = await Node.retrieveL2ChainFromDB(
      db,
      networkId,
      chainId,
      address,
    )
    // if there is no existing l2 chain, create new one
    if (!l2ChainFromDB) {
      const id = uuid()
      const hashers = {
        utxo: poseidonHasher(31),
        withdrawal: keccakHasher(31),
        nullifier: keccakHasher(256),
      }
      const genesisBlock = genesis({ address, hashers })
      await db
        .selectTable(schema.block(id).name)
        .presetQuery('addGenesisBlock', {
          hash: headerHash(genesisBlock),
          header: genesisBlock,
        })
        .exec()
      const l1Config = await l1Contract.getConfig()
      const grove = new Grove(id, db, {
        ...l1Config,
        utxoHasher: hashers.utxo,
        withdrawalHasher: hashers.withdrawal,
        nullifierHasher: hashers.nullifier,
        fullSync: nodeConfig.nodeType === NodeType.FULL_NODE,
        forceUpdate: nodeConfig.nodeType === NodeType.LIGHT_NODE,
        pubKeysToObserve: [],
        addressesToObserve: [],
      })
      l2Chain = new L2Chain(db, grove, {
        id,
        nodeType: nodeConfig.nodeType,
        networkId,
        chainId,
        address,
        config: l1Config,
      })
    } else {
      l2Chain = l2ChainFromDB
    }
    // Get snark verification keys from layer1
    let vks = {}
    if (nodeConfig.verifyOption.snark) {
      vks = await l1Contract.getVKs()
    }
    const verifier = new Verifier(nodeConfig.verifyOption, vks)
    // If the chain needs bootstraping, fetch bootstrap data and apply
    if (await l2Chain.needBootstrapping()) {
      let bootstrapData: BootstrapData | undefined
      if (bootstrapNode) {
        bootstrapData = await bootstrapNode.fetchBootstrapData()
      }
      await l2Chain.bootstrap(bootstrapData)
    }
    const synchronizer = new Synchronizer(db, l2Chain.id, l1Contract)
    return new Node({
      l1Contract,
      l2Chain,
      verifier,
      synchronizer,
      account,
      config: nodeConfig,
    })
  }

  startSync() {
    this.synchronizer.sync()
    this.synchronizer.on('newBlock', this.processUnverifiedBlocks)
  }

  stopSync() {
    this.synchronizer.stop()
    this.synchronizer.off('newBlock', this.processUnverifiedBlocks)
  }

  async processUnverifiedBlocks() {
    // prevHeader should be a verified one
    const { prevHeader, block } = await this.l2Chain.getOldestUnverifiedBlock()
    if (!block) return
    if (!prevHeader)
      throw Error('Unexpected runtime error occured during the verification.')
    const { result, challenge } = await this.verifier.verify(
      this.l1Contract,
      this.l2Chain,
      prevHeader,
      block,
    )
    let status: BlockStatus
    if (challenge) {
      status = BlockStatus.INVALIDATED
      await this.tryChallenge({ block, code: challenge })
    } else {
      status =
        result === VerifyResult.FULLY_VERIFIED
          ? BlockStatus.FULLY_VERIFIED
          : BlockStatus.PARTIALLY_VERIFIED
    }
    await this.l2Chain.apply({ ...block, status })
  }

  private async tryChallenge(challenge: Challenge) {
    // subscribe challenge event from web3 and sync it to the database
    // query database the challenge status
    // request web3 to check if there exists any challenge if you don't have it from the database
    // submit challenge
    console.log(challenge, this)
  }

  // network status
  // addAccounts
  // setAccount
  // getDataForBlockProposing
  // getDataForTxBuilding
  // this.synchronizer = new Synchronizer({
  // })
  static async retrieveL2ChainFromDB(
    db: InanoSQLInstance,
    networkId: number,
    chainId: number,
    address: string,
  ): Promise<L2Chain | null> {
    const chainConfig: ChainConfig[] = (await db
      .selectTable(schema.chain.name)
      .presetQuery('read', {
        networkId,
        chainId,
        address,
      })
      .exec()) as ChainConfig[]
    const l2Config = chainConfig[0]
    if (l2Config) {
      const grove = new Grove(l2Config.id, db, {
        ...l2Config.config,
        utxoHasher: poseidonHasher(31),
        withdrawalHasher: keccakHasher(31),
        nullifierHasher: keccakHasher(256),
        fullSync: l2Config.nodeType === NodeType.FULL_NODE,
        forceUpdate: l2Config.nodeType === NodeType.LIGHT_NODE,
        pubKeysToObserve: [],
        addressesToObserve: [],
      })
      return new L2Chain(db, grove, l2Config)
    }
    return null
  }
}
