import { ZkAccount } from '@zkopru/account'
import { InanoSQLInstance } from '@nano-sql/core'
import { uuid } from '@nano-sql/core/lib/utilities'
import { ChainConfig, schema, BlockStatus } from '@zkopru/database'
import { Grove, poseidonHasher, keccakHasher, verifyProof } from '@zkopru/tree'
import { logger } from '@zkopru/utils'
import { Bytes32 } from 'soltypes'
import { L1Contract } from './layer1'
import { Verifier, VerifyOption } from './verifier'
import { L2Chain } from './layer2'
import { BootstrapHelper } from './bootstrap'
import { headerHash, Block } from './block'
import { Synchronizer } from './synchronizer'

export class ZkOPRUNode {
  db: InanoSQLInstance

  l1Contract: L1Contract

  l2Chain: L2Chain

  verifier: Verifier

  synchronizer: Synchronizer

  bootstrapHelper?: BootstrapHelper

  accounts?: ZkAccount[]

  verifyOption: VerifyOption

  newBlockListner?: () => Promise<void>

  finalizationListener?: (val: string) => Promise<void>

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
    db: InanoSQLInstance
    l1Contract: L1Contract
    l2Chain: L2Chain
    verifier: Verifier
    bootstrapHelper?: BootstrapHelper
    synchronizer: Synchronizer
    accounts?: ZkAccount[]
    verifyOption: VerifyOption
  }) {
    this.db = db
    this.l1Contract = l1Contract
    this.l2Chain = l2Chain
    this.verifier = verifier
    this.synchronizer = synchronizer
    this.bootstrapHelper = bootstrapHelper
    this.accounts = accounts
    this.verifyOption = verifyOption
  }

  startSync() {
    logger.info('start sync')
    this.newBlockListner = () => this.processUnverifiedBlocks()
    this.finalizationListener = hash => this.finalizeBlock(Bytes32.from(hash))
    this.synchronizer.on('newBlock', this.newBlockListner)
    this.synchronizer.on('finalization', this.finalizationListener)
    this.synchronizer.sync()
  }

  stopSync() {
    logger.info('stop sync')
    if (this.newBlockListner) {
      this.synchronizer.off('newBlock', this.newBlockListner)
    }
    if (this.finalizationListener) {
      this.synchronizer.off('finalization', this.finalizationListener)
    }
    this.synchronizer.stop()
  }

  async bootstrap() {
    if (!this.bootstrapHelper) return
    const latest = await this.l1Contract.upstream.methods.latest().call()
    const latestBlockFromDB = await this.l2Chain.getBlockSql(
      Bytes32.from(latest),
    )
    if (
      latestBlockFromDB &&
      latestBlockFromDB.status &&
      latestBlockFromDB.status >= BlockStatus.PARTIALLY_VERIFIED
    ) {
      return
    }
    const bootstrapData = await this.bootstrapHelper.fetchBootstrapData(latest)
    const proposalData = await this.l1Contract.web3.eth.getTransaction(
      bootstrapData.proposalTx,
    )
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

  async processUnverifiedBlocks() {
    logger.info('processUnverifiedBlocks()')
    // prevHeader should be a verified one
    const { prevHeader, block } = await this.l2Chain.getOldestUnverifiedBlock()
    if (!block) return
    if (!prevHeader)
      throw Error('Unexpected runtime error occured during the verification.')
    const patch = await this.verifier.verifyBlock({
      layer1: this.l1Contract,
      layer2: this.l2Chain,
      prevHeader,
      block,
    })

    await this.l2Chain.applyPatch(patch)
  }

  async finalizeBlock(hash: Bytes32) {
    this.l2Chain.finalize(hash)
  }

  static async getOrInitChain(
    db: InanoSQLInstance,
    l1Contract: L1Contract,
    networkId: number,
    chainId: number,
    address: string,
    fullSync: boolean,
    accounts?: ZkAccount[],
  ): Promise<L2Chain> {
    logger.info('Get or init chain')
    console.log('get or init chain called')
    const pubKeysToObserve = accounts
      ? accounts.map(account => account.pubKey)
      : []
    const addressesToObserve = accounts
      ? accounts.map(account => account.address)
      : []

    const chainConfig: ChainConfig[] = (await db
      .selectTable(schema.chain.name)
      .presetQuery('read', {
        networkId,
        chainId,
        address,
      })
      .exec()) as ChainConfig[]
    const l2Config = chainConfig[0]
    const l1Config = await l1Contract.getConfig()
    const hashers = {
      utxo: poseidonHasher(l1Config.utxoTreeDepth),
      withdrawal: keccakHasher(l1Config.withdrawalTreeDepth),
      nullifier: keccakHasher(l1Config.nullifierTreeDepth),
    }
    const tables = await db.query('show tables').exec()
    if (!tables.find(obj => obj.table === schema.block.name)) {
      await db.query('create table', schema.block).exec()
    }
    if (l2Config) {
      const grove = new Grove(l2Config.id, db, {
        ...l1Config,
        utxoHasher: hashers.utxo,
        withdrawalHasher: hashers.withdrawal,
        nullifierHasher: hashers.nullifier,
        fullSync,
        forceUpdate: !fullSync,
        pubKeysToObserve,
        addressesToObserve,
      })
      await grove.init()
      return new L2Chain(db, grove, l2Config)
    }
    const id = uuid()
    const grove = new Grove(id, db, {
      ...l1Config,
      utxoHasher: hashers.utxo,
      withdrawalHasher: hashers.withdrawal,
      nullifierHasher: hashers.nullifier,
      fullSync: true,
      forceUpdate: false,
      pubKeysToObserve,
      addressesToObserve,
    })
    await grove.init()
    return new L2Chain(db, grove, {
      id,
      networkId,
      chainId,
      address,
      config: l1Config,
    })
  }
}
