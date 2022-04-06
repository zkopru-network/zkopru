/* eslint-disable @typescript-eslint/camelcase */
import { Fp } from '@zkopru/babyjubjub'
import { logger } from '@zkopru/utils'
import AsyncLock from 'async-lock'
import assert from 'assert'
import {
  DB,
  TreeSpecies,
  LightTree,
  TreeNode,
  TransactionDB,
} from '@zkopru/database'
import { ZkAddress } from '@zkopru/transaction'
import { BigNumber } from 'ethers'
import { Hasher, genesisRoot } from './hasher'
import { MerkleProof, verifyProof, startingLeafProof } from './merkle-proof'
import { Leaf } from './light-rollup-tree'
import { UtxoTree } from './utxo-tree'
import { WithdrawalTree } from './withdrawal-tree'
import { NullifierTree } from './nullifier-tree'
import { TreeCache } from './utils'

export interface GroveConfig {
  utxoTreeDepth: number
  withdrawalTreeDepth: number
  nullifierTreeDepth: number
  utxoSubTreeSize: number
  withdrawalSubTreeSize: number
  utxoHasher: Hasher<Fp>
  withdrawalHasher: Hasher<BigNumber>
  nullifierHasher: Hasher<BigNumber>
  fullSync?: boolean
  forceUpdate?: boolean
  zkAddressesToObserve: ZkAddress[]
  addressesToObserve: string[]
}

export interface GrovePatch {
  header?: string
  utxos: Leaf<Fp>[]
  withdrawals: Leaf<BigNumber>[]
  nullifiers: Fp[]
}

export interface GroveSnapshot {
  utxoTreeIndex: Fp
  utxoTreeRoot: Fp
  withdrawalTreeIndex: BigNumber
  withdrawalTreeRoot: BigNumber
  nullifierTreeRoot?: BigNumber
}

export class Grove {
  lock: AsyncLock

  db: DB

  config: GroveConfig

  utxoTree!: UtxoTree

  withdrawalTree!: WithdrawalTree

  nullifierTree?: NullifierTree

  treeCache: TreeCache

  constructor(db: DB, config: GroveConfig) {
    this.lock = new AsyncLock()
    this.config = config
    this.db = db
    this.treeCache = new TreeCache()
  }

  async applyBootstrap({
    utxoStartingLeafProof,
    withdrawalStartingLeafProof,
  }: {
    utxoStartingLeafProof: MerkleProof<Fp>
    withdrawalStartingLeafProof: MerkleProof<BigNumber>
  }) {
    logger.info('Applied bootstrap')
    await this.lock.acquire('grove', async () => {
      const utxoBootstrapResult = await this.bootstrapUtxoTree(
        utxoStartingLeafProof,
      )
      const withdrawalBootstrapResult = await this.bootstrapWithdrawalTree(
        withdrawalStartingLeafProof,
      )
      this.utxoTree = utxoBootstrapResult.tree
      this.withdrawalTree = withdrawalBootstrapResult.tree
    })
  }

  async init() {
    await this.lock.acquire('grove', async () => {
      let utxoTreeData = await this.db.findOne('LightTree', {
        where: {
          species: TreeSpecies.UTXO,
        },
      })

      if (utxoTreeData === null) {
        // start a new tree if there's no utxo tree
        const { treeSql } = await this.bootstrapUtxoTree()
        utxoTreeData = treeSql
      }
      assert(utxoTreeData)

      this.utxoTree = UtxoTree.from(
        this.db,
        utxoTreeData,
        {
          hasher: this.config.utxoHasher,
          forceUpdate: this.config.forceUpdate,
          fullSync: this.config.fullSync,
        },
        this.treeCache,
      )

      let withdrawalTreeData = await this.db.findOne('LightTree', {
        where: { species: TreeSpecies.WITHDRAWAL },
      })

      if (withdrawalTreeData === null) {
        // start a new tree if there's no utxo tree
        const { treeSql } = await this.bootstrapWithdrawalTree()
        withdrawalTreeData = treeSql
      }
      assert(withdrawalTreeData)

      this.withdrawalTree = WithdrawalTree.from(
        this.db,
        withdrawalTreeData,
        {
          hasher: this.config.withdrawalHasher,
          forceUpdate: this.config.forceUpdate,
          fullSync: this.config.fullSync,
        },
        this.treeCache,
      )

      this.nullifierTree = new NullifierTree({
        db: this.db,
        hasher: this.config.nullifierHasher,
        depth: this.config.nullifierTreeDepth,
        treeCache: this.treeCache,
      })
    })
  }

  async getSnapshot(): Promise<GroveSnapshot> {
    const result = await this.dryPatch({
      utxos: [],
      withdrawals: [],
      nullifiers: [],
    })
    return result
  }

  setZkAddressesToObserve(addresses: ZkAddress[]) {
    this.config.zkAddressesToObserve = addresses
    this.utxoTree.updatePubKeys(addresses)
  }

  setAddressesToObserve(addresses: string[]) {
    this.config.addressesToObserve = addresses
    this.withdrawalTree.updateAddresses(addresses)
  }

  async applyGrovePatch(
    patch: GrovePatch,
    db: TransactionDB,
  ): Promise<{
    utxoTreeId: string
    withdrawalTreeId: string
  }> {
    let utxoTreeId!: string
    let withdrawalTreeId!: string
    await this.lock.acquire('grove', async () => {
      utxoTreeId = await this.appendUTXOs(patch.utxos, db)
      withdrawalTreeId = await this.appendWithdrawals(patch.withdrawals, db)
      await this.markAsNullified(patch.nullifiers, db)
      if (this.config.fullSync) {
        this.recordBootstrap(db, patch.header)
      }
    })
    return {
      utxoTreeId,
      withdrawalTreeId,
    }
  }

  async dryPatch(patch: GrovePatch): Promise<GroveSnapshot> {
    return this.lock.acquire('grove', async () => {
      const utxoResult = await this.utxoTree.dryAppend(
        patch.utxos.map(leaf => ({ ...leaf, shouldTrack: false })),
      )
      const withdrawalResult = await this.withdrawalTree.dryAppend(
        patch.withdrawals.map(leaf => ({ ...leaf, shouldTrack: false })),
      )
      const nullifierRoot = await this.nullifierTree?.dryRunNullify(
        ...patch.nullifiers,
      )
      const utxoFixedSizeLen =
        this.config.utxoSubTreeSize *
        Math.ceil(patch.utxos.length / this.config.utxoSubTreeSize)
      const withdrawalFixedSizeLen =
        this.config.withdrawalSubTreeSize *
        Math.ceil(patch.withdrawals.length / this.config.withdrawalSubTreeSize)

      return {
        utxoTreeIndex: utxoResult.index
          .add(utxoFixedSizeLen)
          .sub(patch.utxos.length),
        utxoTreeRoot: utxoResult.root,
        withdrawalTreeIndex: withdrawalResult.index
          .add(withdrawalFixedSizeLen)
          .sub(patch.withdrawals.length),
        withdrawalTreeRoot: withdrawalResult.root,
        nullifierTreeRoot: nullifierRoot,
      }
    })
  }

  private recordBootstrap(db: TransactionDB, header?: string): void {
    const bootstrapData = {
      utxoBootstrap: JSON.stringify(
        this.utxoTree.data.siblings.map(val => val.toHexString()),
      ),
      withdrawalBootstrap: JSON.stringify(
        this.withdrawalTree.data.siblings.map(val => val.toHexString()),
      ),
    }
    if (header) {
      db.upsert('Bootstrap', {
        where: { blockHash: header },
        update: bootstrapData,
        create: bootstrapData,
      })
      db.upsert('Block', {
        where: { hash: header },
        update: {},
        create: { hash: header },
      })
    } else {
      db.create('Bootstrap', bootstrapData)
    }
  }

  /**
   *
   * @param utxos utxos to append
   * @returns treeId of appended to
   */
  private async appendUTXOs(
    utxos: Leaf<Fp>[],
    db: TransactionDB,
  ): Promise<string> {
    const totalItemLen =
      this.config.utxoSubTreeSize *
      Math.ceil(utxos.length / this.config.utxoSubTreeSize)

    const padding: Leaf<Fp>[] = Array(totalItemLen - utxos.length)
      .fill(null)
      .map(() => ({
        hash: Fp.zero,
      }))
    const paddedUtxos = [...utxos, ...padding]
    if (!this.utxoTree) throw Error('Grove is not initialized')
    if (
      this.utxoTree
        .latestLeafIndex()
        .add(totalItemLen)
        .lte(this.utxoTree.maxSize())
    ) {
      await this.utxoTree.append(paddedUtxos, db)
    } else {
      throw Error('utxo tree flushes.')
    }
    return this.utxoTree.metadata.id
  }

  private async appendWithdrawals(
    withdrawals: Leaf<BigNumber>[],
    db: TransactionDB,
  ): Promise<string> {
    const totalItemLen =
      this.config.withdrawalSubTreeSize *
      Math.ceil(withdrawals.length / this.config.withdrawalSubTreeSize)

    const padding: Leaf<Fp>[] = Array(totalItemLen - withdrawals.length)
      .fill(null)
      .map(() => ({
        hash: Fp.zero,
      }))
    const paddedWithdrawals = [...withdrawals, ...padding]
    if (!this.withdrawalTree) throw Error('Grove is not initialized')
    if (
      this.withdrawalTree
        .latestLeafIndex()
        .add(totalItemLen)
        .lte(this.withdrawalTree.maxSize())
    ) {
      await this.withdrawalTree.append(paddedWithdrawals, db)
    } else {
      throw Error('withdrawal tree flushes')
    }
    return this.withdrawalTree.metadata.id
  }

  private async markAsNullified(
    nullifiers: BigNumber[],
    db: TransactionDB,
  ): Promise<void> {
    // only the full node manages the nullifier tree
    const tree = this.nullifierTree
    if (tree) {
      await tree.nullify(nullifiers, db)
    }
  }

  async utxoMerkleProof(hash: Fp): Promise<MerkleProof<Fp>> {
    const utxo = await this.db.findOne('Utxo', {
      where: { hash: hash.toString() },
    })
    if (!utxo) throw Error('Failed to find the utxo')
    if (!utxo.index) throw Error('It is not included in a block yet')

    const cachedSiblings = await this.treeCache.getCachedSiblings(
      this.db,
      this.config.utxoTreeDepth,
      this.utxoTree.metadata.id,
      utxo.index,
    )
    let root: Fp = this.utxoTree.root()
    const siblings = [...this.config.utxoHasher.preHash.slice(0, -1)]
    cachedSiblings.forEach((obj: TreeNode) => {
      const level =
        1 +
        this.config.utxoTreeDepth -
        BigNumber.from(obj.nodeIndex || 0)
          .toBigInt()
          .toString(2).length
      if (level === this.config.utxoTreeDepth) {
        root = Fp.from(obj.value)
      } else {
        siblings[level] = Fp.from(obj.value)
      }
    })
    const proof = {
      root,
      index: Fp.from(utxo.index),
      leaf: Fp.from(utxo.hash),
      siblings,
    }
    const isValid = verifyProof(this.config.utxoHasher, proof)
    if (!isValid) throw Error('Failed to generate utxo merkle proof')
    return proof
  }

  async withdrawalMerkleProof(
    noteHash: BigNumber,
    index?: BigNumber,
  ): Promise<MerkleProof<BigNumber>> {
    const withdrawal = await this.db.findOne('Withdrawal', {
      where: { withdrawalHash: noteHash.toString() },
    })
    if (!withdrawal) throw Error('Failed to find the withdrawal')
    const leafIndex = index?.toString() || withdrawal.index
    if (!leafIndex) throw Error('It is not included in a block yet')

    const cachedSiblings = await this.treeCache.getCachedSiblings(
      this.db,
      this.config.withdrawalTreeDepth,
      this.withdrawalTree.metadata.id,
      leafIndex,
    )
    let root: BigNumber = this.withdrawalTree.root()
    const siblings = [...this.config.withdrawalHasher.preHash.slice(0, -1)]
    cachedSiblings.forEach((obj: TreeNode) => {
      const level =
        1 +
        this.config.withdrawalTreeDepth -
        BigNumber.from(obj.nodeIndex || 0)
          .toBigInt()
          .toString(2).length
      if (level === this.config.withdrawalTreeDepth) {
        root = BigNumber.from(obj.value)
      } else {
        siblings[level] = BigNumber.from(obj.value)
      }
    })
    const proof = {
      root,
      index: BigNumber.from(leafIndex),
      leaf: noteHash,
      siblings,
    }
    const isValid = verifyProof(this.config.withdrawalHasher, proof)
    if (!isValid) throw Error('Failed to generate withdrawal merkle proof')
    return proof
  }

  private async bootstrapUtxoTree(
    proof?: MerkleProof<Fp>,
  ): Promise<{ treeSql: LightTree; tree: UtxoTree }> {
    const hasher = this.config.utxoHasher
    let root: Fp
    let index: Fp
    let siblings: Fp[]

    if (proof) {
      root = proof.root
      index = proof.index
      siblings = proof.siblings
      if (!startingLeafProof(hasher, proof.root, proof.index, proof.siblings)) {
        throw Error('Invalid starting leaf proof')
      }
    } else {
      root = genesisRoot(hasher)
      index = Fp.zero
      siblings = hasher.preHash.slice(0, -1)
    }
    const data = {
      root: root.toString(),
      index: index.toString(),
      siblings: JSON.stringify(siblings.map(f => f.toString())),
      start: index.toString(),
      end: index.toString(),
    }
    await this.db.upsert('LightTree', {
      where: { species: TreeSpecies.UTXO },
      update: { ...data },
      create: { species: TreeSpecies.UTXO, ...data },
      constraintKey: 'species',
    })
    const treeSql = await this.db.findOne('LightTree', {
      where: {
        species: TreeSpecies.UTXO,
      },
    })
    const tree = UtxoTree.from(
      this.db,
      treeSql,
      {
        hasher: this.config.utxoHasher,
        forceUpdate: this.config.forceUpdate,
        fullSync: this.config.fullSync,
      },
      this.treeCache,
    )
    return { treeSql, tree }
  }

  private async bootstrapWithdrawalTree(
    proof?: MerkleProof<BigNumber>,
  ): Promise<{ treeSql: LightTree; tree: WithdrawalTree }> {
    const hasher = this.config.withdrawalHasher
    let root: BigNumber
    let index: BigNumber
    let siblings: BigNumber[]

    if (proof) {
      root = proof.root
      index = proof.index
      siblings = proof.siblings
      if (!startingLeafProof(hasher, proof.root, proof.index, proof.siblings)) {
        throw Error('Invalid starting leaf proof')
      }
    } else {
      // NTODO
      root = genesisRoot(hasher)
      index = BigNumber.from(0)
      siblings = hasher.preHash.slice(0, -1)
    }
    const data = {
      root: root.toString(),
      index: index.toString(),
      siblings: JSON.stringify(siblings.map(val => val.toHexString())),
      start: index.toString(),
      end: index.toString(),
    }
    await this.db.upsert('LightTree', {
      where: { species: TreeSpecies.WITHDRAWAL },
      update: { ...data },
      create: { species: TreeSpecies.WITHDRAWAL, ...data },
      constraintKey: 'species',
    })
    const treeSql = await this.db.findOne('LightTree', {
      where: {
        species: TreeSpecies.WITHDRAWAL,
      },
    })
    const tree = WithdrawalTree.from(
      this.db,
      treeSql,
      {
        hasher: this.config.withdrawalHasher,
        forceUpdate: this.config.forceUpdate,
        fullSync: this.config.fullSync,
      },
      this.treeCache,
    )
    return { treeSql, tree }
  }
}
