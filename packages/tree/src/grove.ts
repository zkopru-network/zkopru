import { InanoSQLInstance } from '@nano-sql/core'
import {
  LightRollUpTreeSql,
  schema,
  TreeNodeSql,
  UtxoSql,
} from '@zkopru/database'
import { Field, Point } from '@zkopru/babyjubjub'
import AsyncLock from 'async-lock'
import { Hasher } from './hasher'
import { MerkleProof, verifyProof, startingLeafProof } from './merkle-proof'
import { Item } from './light-rollup-tree'
import { UtxoTree } from './utxo-tree'
import { WithdrawalTree } from './withdrawal-tree'
import { NullifierTree } from './nullifier-tree'

export interface GroveConfig {
  utxoTreeDepth: number
  withdrawalTreeDepth: number
  nullifierTreeDepth: number
  utxoSubTreeSize: number
  withdrawalSubTreeSize: number
  utxoHasher: Hasher
  withdrawalHasher: Hasher
  nullifierHasher: Hasher
  fullSync?: boolean
  forceUpdate?: boolean
  pubKeysToObserve: Point[]
  addressesToObserve: string[]
}

export interface GrovePatch {
  header: string
  utxos: Item[]
  withdrawals: Field[]
  nullifiers: Field[]
}

export class Grove {
  lock: AsyncLock

  zkopruId: string

  db: InanoSQLInstance

  config: GroveConfig

  utxoTrees!: UtxoTree[]

  withdrawalTrees!: WithdrawalTree[]

  nullifierTree?: NullifierTree

  constructor(zkopruId: string, db: InanoSQLInstance, config: GroveConfig) {
    this.lock = new AsyncLock()
    this.zkopruId = zkopruId
    this.config = config
    this.db = db
  }

  async applyBootstrap({
    utxoTreeIndex,
    utxoStartingLeafProof,
    withdrawalTreeIndex,
    withdrawalStartingLeafProof,
  }: {
    utxoTreeIndex: number
    utxoStartingLeafProof: MerkleProof
    withdrawalTreeIndex: number
    withdrawalStartingLeafProof: MerkleProof
  }) {
    await this.lock.acquire('grove', async () => {
      await this.bootstrapUtxoTree(utxoTreeIndex, utxoStartingLeafProof)
      await this.bootstrapWithdrawalTree(
        withdrawalTreeIndex,
        withdrawalStartingLeafProof,
      )
    })
  }

  async init() {
    await this.lock.acquire('grove', async () => {
      const utxoTreeSqls = (
        await this.db
          .selectTable(schema.utxoTree.name)
          .query('select')
          .where(['zkopru', '=', this.zkopruId])
          .exec()
      ).sort((a, b) => a.index - b.index) as LightRollUpTreeSql[]

      if (utxoTreeSqls.length === 0) {
        // start a new tree if there's no utxo tree
        const { treeSql } = await this.bootstrapUtxoTree(0)
        utxoTreeSqls.push(treeSql)
      }

      this.utxoTrees = utxoTreeSqls.map(obj =>
        UtxoTree.from(this.db, obj, {
          hasher: this.config.utxoHasher,
          forceUpdate: this.config.forceUpdate,
          fullSync: this.config.fullSync,
        }),
      )

      const withdrawalTreeSqls = (
        await this.db
          .selectTable(schema.withdrawalTree.name)
          .query('select')
          .where(['zkopru', '=', this.zkopruId])
          .exec()
      ).sort((a, b) => a.index - b.index) as LightRollUpTreeSql[]

      if (withdrawalTreeSqls.length === 0) {
        // start a new tree if there's no utxo tree
        const { treeSql } = await this.bootstrapWithdrawalTree(0)
        withdrawalTreeSqls.push(treeSql)
      }

      this.withdrawalTrees = withdrawalTreeSqls.map(obj =>
        WithdrawalTree.from(this.db, obj, {
          hasher: this.config.withdrawalHasher,
          forceUpdate: this.config.forceUpdate,
          fullSync: this.config.fullSync,
        }),
      )

      this.nullifierTree = new NullifierTree({
        db: this.db,
        hasher: this.config.nullifierHasher,
        zkopruId: this.zkopruId,
        depth: this.config.nullifierTreeDepth,
      })
    })
  }

  setPubKeysToObserve(points: Point[]) {
    this.config.pubKeysToObserve = points
    this.utxoTrees.forEach(tree => tree.updatePubKeys(points))
  }

  setAddressesToObserve(addresses: string[]) {
    this.config.addressesToObserve = addresses
    this.withdrawalTrees.forEach(tree => tree.updateAddresses(addresses))
  }

  latestUTXOTree(): UtxoTree {
    return this.utxoTrees[this.utxoTrees.length - 1]
  }

  latestWithdrawalTree(): WithdrawalTree {
    return this.withdrawalTrees[this.withdrawalTrees.length - 1]
  }

  async applyPatch(patch: GrovePatch) {
    await this.lock.acquire('grove', async () => {
      await this.appendUTXOs(patch.utxos)
      await this.appendWithdrawals(patch.withdrawals)
      await this.markAsNullified(patch.header, patch.nullifiers)
      if (this.config.fullSync) {
        await this.recordBootstrap(patch.header)
      }
    })
  }

  async dryPatch(
    patch: GrovePatch,
  ): Promise<{
    utxoTreeIndex: Field
    utxoTreeRoot: Field
    withdrawalTreeIndex: Field
    withdrawalTreeRoot: Field
    nullifierTreeRoot?: Field
  }> {
    let result!: {
      utxoTreeIndex: Field
      utxoTreeRoot: Field
      withdrawalTreeIndex: Field
      withdrawalTreeRoot: Field
      nullifierTreeRoot?: Field
    }
    await this.lock.acquire('grove', async () => {
      const utxoResult = await this.latestUTXOTree().dryAppend(...patch.utxos)
      const withdrawalResult = await this.latestWithdrawalTree().dryAppend(
        ...patch.withdrawals.map(leafHash => ({ leafHash })),
      )
      const nullifierRoot = await this.nullifierTree?.dryRunNullify(
        ...patch.nullifiers,
      )
      result.utxoTreeIndex = utxoResult.index
      result.utxoTreeRoot = utxoResult.root
      result.withdrawalTreeIndex = withdrawalResult.index
      result.withdrawalTreeRoot = withdrawalResult.root
      result.nullifierTreeRoot = nullifierRoot
    })
    return result
  }

  private async recordBootstrap(header: string): Promise<void> {
    await this.db
      .selectTable(schema.block(this.zkopruId).name)
      .presetQuery('recordBootstrap', {
        hash: header,
        bootstrap: {
          utxoTreeIndex: this.latestUTXOTree().metadata.index,
          utxoBootstrap: this.latestUTXOTree().data.siblings,
          withdrawalTreeIndex: this.latestWithdrawalTree().metadata.index,
          withdrawlBootstrap: this.latestWithdrawalTree().data.siblings,
        },
      })
      .exec()
  }

  private async appendUTXOs(utxos: Item[]): Promise<void> {
    const fixedSizeUtxos: Item[] = Array(this.config.utxoSubTreeSize).fill({
      leafHash: Field.zero,
    })
    utxos.forEach((item: Item, index: number) => {
      fixedSizeUtxos[index] = item
    })
    const latestTree = this.latestUTXOTree()
    if (!latestTree) throw Error('Grove is not initialized')
    if (
      latestTree
        .latestLeafIndex()
        .add(this.config.utxoSubTreeSize)
        .lt(latestTree.maxSize())
    ) {
      await latestTree.append(...fixedSizeUtxos)
    } else {
      const { tree } = await this.bootstrapUtxoTree(
        latestTree.metadata.index + 1,
      )
      this.utxoTrees.push(tree)
      await tree.append(...fixedSizeUtxos)
    }
  }

  private async appendWithdrawals(withdrawals: Field[]): Promise<void> {
    const fixedSizeWithdrawals: Item[] = Array(
      this.config.withdrawalSubTreeSize,
    ).fill({
      leafHash: Field.zero,
    })
    withdrawals.forEach((withdrawal: Field, index: number) => {
      fixedSizeWithdrawals[index] = {
        leafHash: withdrawal,
      }
    })
    const latestTree = this.latestWithdrawalTree()
    if (!latestTree) throw Error('Grove is not initialized')
    if (
      latestTree
        .latestLeafIndex()
        .add(this.config.withdrawalSubTreeSize)
        .lt(latestTree.maxSize())
    ) {
      await latestTree.append(...fixedSizeWithdrawals)
    } else {
      const { tree } = await this.bootstrapWithdrawalTree(
        latestTree.metadata.index + 1,
      )
      this.withdrawalTrees.push(tree)
      await tree.append(...fixedSizeWithdrawals)
    }
  }

  private async markAsNullified(
    block: string,
    nullifiers: Field[],
  ): Promise<void> {
    // only the full node manages the nullifier tree
    const tree = this.nullifierTree
    if (tree) {
      await tree.nullify(nullifiers, block)
    }
  }

  async utxoMerkleProof(hash: Field): Promise<MerkleProof> {
    const queryResult = await this.db
      .selectTable(schema.utxo.name)
      .query('select')
      .where(['hash', '=', hash.toHex()])
      .exec()
    const utxo: UtxoSql = queryResult.pop() as UtxoSql
    if (!utxo) throw Error('Failed to find the utxo')

    const cachedSiblings = (await this.db
      .selectTable(schema.utxoTreeNode(utxo.tree).name)
      .presetQuery('getSiblings', {
        depth: this.config.utxoTreeDepth,
        index: utxo.index,
      })
      .exec()) as TreeNodeSql[]
    let root!: Field
    const siblings = [...this.config.utxoHasher.preHash]
    cachedSiblings.forEach((obj: TreeNodeSql) => {
      const level =
        1 +
        this.config.utxoTreeDepth -
        Field.from(obj.nodeIndex || 0).toString(2).length
      if (level === this.config.utxoTreeDepth) {
        root = Field.from(obj.value)
      } else {
        siblings[level] = Field.from(obj.value)
      }
    })
    if (!root) throw Error('Failed to find root')
    const proof = {
      root,
      index: Field.from(utxo.index),
      leaf: Field.from(utxo.hash),
      siblings,
    }
    verifyProof(this.config.utxoHasher, proof)
    return proof
  }

  async withdrawalMerkleProof(hash: Field): Promise<MerkleProof> {
    const queryResult = await this.db
      .selectTable(schema.withdrawal.name)
      .query('select')
      .where(['hash', '=', hash.toHex()])
      .exec()
    const withdrawal: UtxoSql = queryResult.pop() as UtxoSql
    if (!withdrawal) throw Error('Failed to find the withdrawal')

    const cachedSiblings = (await this.db
      .selectTable(schema.withdrawalTreeNode(withdrawal.tree).name)
      .presetQuery('getSiblings', {
        depth: this.config.withdrawalTreeDepth,
        index: withdrawal.index,
      })
      .exec()) as TreeNodeSql[]
    let root!: Field
    const siblings = [...this.config.withdrawalHasher.preHash]
    cachedSiblings.forEach((obj: TreeNodeSql) => {
      const level =
        1 +
        this.config.withdrawalTreeDepth -
        Field.from(obj.nodeIndex || 0).toString(2).length
      if (level === this.config.withdrawalTreeDepth) {
        root = Field.from(obj.value)
      } else {
        siblings[level] = Field.from(obj.value)
      }
    })
    if (!root) throw Error('Failed to find root')
    const proof = {
      root,
      index: Field.from(withdrawal.index),
      leaf: Field.from(withdrawal.hash),
      siblings,
    }
    verifyProof(this.config.withdrawalHasher, proof)
    return proof
  }

  private async bootstrapUtxoTree(
    treeIndex: number,
    proof?: MerkleProof,
  ): Promise<{ treeSql: LightRollUpTreeSql; tree: UtxoTree }> {
    const hasher = this.config.utxoHasher
    let data: { root: string; index: string; siblings: string[] }
    if (proof) {
      data = {
        root: proof.root.toHex(),
        index: proof.index.toHex(),
        siblings: proof.siblings.map(s => s.toHex()),
      }
      if (!startingLeafProof(hasher, proof.root, proof.index, proof.siblings)) {
        throw Error('Invalid starting leaf proof')
      }
    } else {
      data = {
        root: ([...hasher.preHash].pop() as Field).toHex(),
        index: Field.zero.toHex(),
        siblings: hasher.preHash.map(f => f.toHex()),
      }
    }
    const treeSql = (
      await this.db
        .selectTable(schema.utxoTree.name)
        .presetQuery('bootstrapTree', {
          index: treeIndex,
          zkopru: this.zkopruId,
          data,
        })
        .exec()
    ).pop() as LightRollUpTreeSql
    const tree = UtxoTree.from(this.db, treeSql, {
      hasher: this.config.utxoHasher,
      forceUpdate: this.config.forceUpdate,
      fullSync: this.config.fullSync,
    })
    return { treeSql, tree }
  }

  private async bootstrapWithdrawalTree(
    treeIndex: number,
    proof?: MerkleProof,
  ): Promise<{ treeSql: LightRollUpTreeSql; tree: WithdrawalTree }> {
    const hasher = this.config.withdrawalHasher
    let data: { root: string; index: string; siblings: string[] }
    if (proof) {
      data = {
        root: proof.root.toHex(),
        index: proof.index.toHex(),
        siblings: proof.siblings.map(s => s.toHex()),
      }
      if (!startingLeafProof(hasher, proof.root, proof.index, proof.siblings)) {
        throw Error('Invalid starting leaf proof')
      }
    } else {
      data = {
        root: ([...hasher.preHash].pop() as Field).toHex(),
        index: Field.zero.toHex(),
        siblings: hasher.preHash.map(f => f.toHex()),
      }
    }
    const treeSql = (
      await this.db
        .selectTable(schema.withdrawalTree.name)
        .presetQuery('bootstrapTree', {
          index: treeIndex,
          zkopru: this.zkopruId,
          data,
        })
        .exec()
    ).pop() as LightRollUpTreeSql
    const tree = WithdrawalTree.from(this.db, treeSql, {
      hasher: this.config.withdrawalHasher,
      forceUpdate: this.config.forceUpdate,
      fullSync: this.config.fullSync,
    })
    return { treeSql, tree }
  }
}
