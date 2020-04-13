import { ZkAccount } from '@zkopru/account'
import { WebsocketProvider, IpcProvider } from 'web3-core'
import { InanoSQLInstance } from '@nano-sql/core'
import { uuid } from '@nano-sql/core/lib/utilities'
import Web3 from 'web3'
import { ChainConfig, NodeType, schema, BlockStatus } from '@zkopru/database'
import { Grove, poseidonHasher, keccakHasher, merkleProof } from '@zkopru/tree'
import { L1Contract } from './layer1'
import { Verifier, VerifyOption, VerifyResult } from './verifier'
import { L2Chain } from './layer2'
import { BootstrapHelper } from './bootstrap'
import { headerHash, deserializeBlockFromL1Tx } from './block'
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

  bootstrapHelper?: BootstrapHelper

  accounts?: ZkAccount[]

  status: Status

  config: NodeConfiguration

  constructor({
    l1Contract,
    l2Chain,
    verifier,
    synchronizer,
    bootstrapHelper,
    accounts,
    config,
  }: {
    l1Contract: L1Contract
    l2Chain: L2Chain
    verifier: Verifier
    bootstrapHelper?: BootstrapHelper
    synchronizer: Synchronizer
    accounts?: ZkAccount[]
    config: NodeConfiguration
  }) {
    if (config.nodeType === NodeType.LIGHT_NODE && config.verifyOption) {
      throw Error('Only Full node can process verifications')
    }
    if (config.nodeType === NodeType.LIGHT_NODE && !accounts) {
      throw Error('You can run light node without setting accounts')
    }
    this.l1Contract = l1Contract
    this.l2Chain = l2Chain
    this.verifier = verifier
    this.synchronizer = synchronizer
    this.bootstrapHelper = bootstrapHelper
    this.accounts = accounts
    this.config = config
    this.status = Status.STOPPED
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
    db: InanoSQLInstance
    accounts?: ZkAccount[]
    bootstrapHelper?: BootstrapHelper
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
    const isFullNode: boolean = nodeConfig.nodeType === NodeType.FULL_NODE
    if (isFullNode && !bootstrapHelper)
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
      const addressesToObserve = accounts
        ? accounts.map(account => account.address)
        : []
      const pubKeysToObserve = accounts
        ? accounts.map(account => account.pubKey)
        : []
      const grove = new Grove(id, db, {
        ...l1Config,
        utxoHasher: hashers.utxo,
        withdrawalHasher: hashers.withdrawal,
        nullifierHasher: hashers.nullifier,
        fullSync: isFullNode,
        forceUpdate: !isFullNode,
        pubKeysToObserve,
        addressesToObserve,
      })
      await grove.init()
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
    let vks = {}
    if (nodeConfig.verifyOption.snark) {
      vks = await l1Contract.getVKs()
    }
    const verifier = new Verifier(nodeConfig.verifyOption, vks)
    // If the chain needs bootstraping, fetch bootstrap data and apply
    const synchronizer = new Synchronizer(db, l2Chain.id, l1Contract)
    return new Node({
      l1Contract,
      l2Chain,
      verifier,
      synchronizer,
      bootstrapHelper,
      accounts,
      config: nodeConfig,
    })
  }

  async startSync() {
    if (this.config.nodeType === NodeType.LIGHT_NODE) {
      await this.bootstrap()
    }
    this.synchronizer.sync()
    this.synchronizer.on('newBlock', this.processUnverifiedBlocks)
  }

  stopSync() {
    this.synchronizer.stop()
    this.synchronizer.off('newBlock', this.processUnverifiedBlocks)
  }

  async bootstrap() {
    if (!this.bootstrapHelper) return
    const latest = await this.l1Contract.upstream.methods.latest().call()
    const latestBlockFromDB = await this.l2Chain.getBlock(latest)
    if (
      latestBlockFromDB &&
      latestBlockFromDB.status &&
      latestBlockFromDB.status >= BlockStatus.PARTIALLY_VERIFIED
    ) {
      return
    }
    const bootstrapData = await this.bootstrapHelper.fetchBootstrapData(latest)
    const txData = await this.l1Contract.web3.eth.getTransaction(
      bootstrapData.txHash,
    )
    const block = deserializeBlockFromL1Tx(txData)
    const headerProof = headerHash(block.header) === latest
    const utxoMerkleProof = merkleProof(
      this.l2Chain.grove.config.utxoHasher,
      bootstrapData.utxoTreeBootstrap,
    )
    const withdrawalMerkleProof = merkleProof(
      this.l2Chain.grove.config.withdrawalHasher,
      bootstrapData.withdrawalTreeBootstrap,
    )
    if (headerProof && utxoMerkleProof && withdrawalMerkleProof) {
      await this.l2Chain.applyBootstrap(block, bootstrapData)
    }
  }

  async processUnverifiedBlocks() {
    // prevHeader should be a verified one
    const { prevHeader, block } = await this.l2Chain.getOldestUnverifiedBlock()
    if (!block) return
    if (!prevHeader)
      throw Error('Unexpected runtime error occured during the verification.')
    const { result, challenge } = await this.verifier.verify({
      layer1: this.l1Contract,
      layer2: this.l2Chain,
      prevHeader,
      block,
    })
    if (challenge) {
      await this.l2Chain.markAsInvalidated(block.hash)
      await challenge.send()
    } else if (result === VerifyResult.FULLY_VERIFIED) {
      await this.l2Chain.markAsFullyVerified(block.hash)
    } else {
      await this.l2Chain.markAsPartiallyVerified(block.hash)
    }
  }

  async getNetworkStatus(): Promise<Status> {
    if (!this.synchronizer.isSyncing) return Status.STOPPED
    const lastestProposal = await this.l2Chain.db
      .selectTable(schema.block(this.l2Chain.id).name)
      .presetQuery('getBlockNumForLatestProposal')
      .exec()
    const l1BlockNumOfLatestProposal = lastestProposal[0].proposedAt
    const latestVerification = await this.l2Chain.db
      .selectTable(schema.block(this.l2Chain.id).name)
      .presetQuery('getLastVerfiedBlock')
      .exec()
    const l1BlockNumOfLatestVerified = latestVerification[0].proposedAt
    if (l1BlockNumOfLatestProposal - l1BlockNumOfLatestVerified < 5) {
      return Status.LIVE
    }
    // TODO: layer1 REVERT handling & challenge handling
    return Status.ON_SYNCING
  }

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
