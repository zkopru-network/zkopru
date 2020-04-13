import { ZkAccount } from '@zkopru/account'
import { InanoSQLInstance } from '@nano-sql/core'
import { uuid } from '@nano-sql/core/lib/utilities'
import { ChainConfig, schema, BlockStatus } from '@zkopru/database'
import { Grove, poseidonHasher, keccakHasher, merkleProof } from '@zkopru/tree'
import { L1Contract } from './layer1'
import { Verifier, VerifyOption, VerifyResult } from './verifier'
import { L2Chain } from './layer2'
import { BootstrapHelper } from './bootstrap'
import { headerHash, deserializeBlockFromL1Tx } from './block'
import { Synchronizer } from './synchronizer'
import { genesis } from './genesis'

export class ZkOPRUNode {
  l1Contract: L1Contract

  l2Chain: L2Chain

  verifier: Verifier

  synchronizer: Synchronizer

  bootstrapHelper?: BootstrapHelper

  accounts?: ZkAccount[]

  verifyOption: VerifyOption

  constructor({
    l1Contract,
    l2Chain,
    verifier,
    synchronizer,
    bootstrapHelper,
    accounts,
    verifyOption,
  }: {
    l1Contract: L1Contract
    l2Chain: L2Chain
    verifier: Verifier
    bootstrapHelper?: BootstrapHelper
    synchronizer: Synchronizer
    accounts?: ZkAccount[]
    verifyOption: VerifyOption
  }) {
    this.l1Contract = l1Contract
    this.l2Chain = l2Chain
    this.verifier = verifier
    this.synchronizer = synchronizer
    this.bootstrapHelper = bootstrapHelper
    this.accounts = accounts
    this.verifyOption = verifyOption
  }

  startSync() {
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

  static async getOrInitChain(
    db: InanoSQLInstance,
    l1Contract: L1Contract,
    networkId: number,
    chainId: number,
    address: string,
    fullSync: boolean,
    accounts?: ZkAccount[],
  ): Promise<L2Chain> {
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
    if (l2Config) {
      const grove = new Grove(l2Config.id, db, {
        ...l2Config.config,
        utxoHasher: poseidonHasher(31),
        withdrawalHasher: keccakHasher(31),
        nullifierHasher: keccakHasher(256),
        fullSync,
        forceUpdate: !fullSync,
        pubKeysToObserve,
        addressesToObserve,
      })
      return new L2Chain(db, grove, l2Config)
    }
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
