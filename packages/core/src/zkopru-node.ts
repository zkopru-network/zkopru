/* eslint-disable @typescript-eslint/camelcase */
import { ZkAccount } from '@zkopru/account'
import { DB } from '@zkopru/prisma'
import { Grove, poseidonHasher, keccakHasher } from '@zkopru/tree'
import { logger } from '@zkopru/utils'
import { Bytes32 } from 'soltypes'
import { L1Contract } from './layer1'
import { Verifier, VerifyOption } from './verifier'
import { L2Chain } from './layer2'
import { BootstrapHelper } from './bootstrap'
import { Synchronizer } from './synchronizer'

export class ZkOPRUNode {
  db: DB

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
    db: DB
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
    db: DB,
    l1Contract: L1Contract,
    networkId: number,
    chainId: number,
    address: string,
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

    const savedConfig = await db.prisma.config.findOne({
      where: {
        networkId_chainId_address: {
          networkId,
          chainId,
          address,
        },
      },
    })
    const config = savedConfig || (await l1Contract.getConfig())
    const hashers = {
      utxo: poseidonHasher(config.utxoTreeDepth),
      withdrawal: keccakHasher(config.withdrawalTreeDepth),
      nullifier: keccakHasher(config.nullifierTreeDepth),
    }
    const grove = new Grove(db, {
      ...config,
      utxoHasher: hashers.utxo,
      withdrawalHasher: hashers.withdrawal,
      nullifierHasher: hashers.nullifier,
      fullSync: true,
      forceUpdate: false,
      pubKeysToObserve,
      addressesToObserve,
    })
    await grove.init()
    return new L2Chain(db, grove, config)
  }
}
