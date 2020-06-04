import { InanoSQLInstance } from '@nano-sql/core'
import {
  LightRollUpTreeSql,
  schema,
  TreeNodeSql,
  UtxoSql,
} from '@zkopru/database'
import { Field, Point } from '@zkopru/babyjubjub'
import { logger, hexify } from '@zkopru/utils'
import AsyncLock from 'async-lock'
import BN from 'bn.js'
import { toBN } from 'web3-utils'
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
  utxoHasher: Hasher<Field>
  withdrawalHasher: Hasher<BN>
  nullifierHasher: Hasher<BN>
  fullSync?: boolean
  forceUpdate?: boolean
  pubKeysToObserve: Point[]
  addressesToObserve: string[]
}

export interface GrovePatch {
  header?: string
  utxos: Item<Field>[]
  withdrawals: BN[]
  nullifiers: BN[]
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
    utxoStartingLeafProof: MerkleProof<Field>
    withdrawalTreeIndex: number
    withdrawalStartingLeafProof: MerkleProof<BN>
  }) {
    logger.info('Applied bootstrap')
    await this.lock.acquire('grove', async () => {
      const utxoBootstrapResult = await this.bootstrapUtxoTree(
        utxoTreeIndex,
        utxoStartingLeafProof,
      )
      const withdrawalBootstrapResult = await this.bootstrapWithdrawalTree(
        withdrawalTreeIndex,
        withdrawalStartingLeafProof,
      )
      this.utxoTrees.push(utxoBootstrapResult.tree)
      this.withdrawalTrees.push(withdrawalBootstrapResult.tree)
    })
  }

  async init() {
    logger.debug('init() called')
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
      if (!patch.header)
        throw Error('header data is required to apply the patch')
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
    withdrawalTreeIndex: BN
    withdrawalTreeRoot: BN
    nullifierTreeRoot?: BN
  }> {
    let result!: {
      utxoTreeIndex: Field
      utxoTreeRoot: Field
      withdrawalTreeIndex: BN
      withdrawalTreeRoot: BN
      nullifierTreeRoot?: BN
    }
    await this.lock.acquire('grove', async () => {
      const utxoResult = await this.latestUTXOTree().dryAppend(...patch.utxos)
      const withdrawalResult = await this.latestWithdrawalTree().dryAppend(
        ...patch.withdrawals.map(leafHash => ({ leafHash })),
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

      result = {
        utxoTreeIndex: utxoResult.index
          .addn(utxoFixedSizeLen)
          .subn(patch.utxos.length),
        utxoTreeRoot: utxoResult.root,
        withdrawalTreeIndex: withdrawalResult.index
          .addn(withdrawalFixedSizeLen)
          .subn(patch.withdrawals.length),
        withdrawalTreeRoot: withdrawalResult.root,
        nullifierTreeRoot: nullifierRoot,
      }
    })
    return result
  }

  private async recordBootstrap(header: string): Promise<void> {
    await this.db
      .selectTable(schema.block.name)
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

  private async appendUTXOs(utxos: Item<Field>[]): Promise<void> {
    const totalItemLen =
      this.config.utxoSubTreeSize *
      Math.ceil(utxos.length / this.config.utxoSubTreeSize)

    const fixedSizeUtxos: Item<Field>[] = Array(totalItemLen).fill({
      leafHash: Field.zero,
    })
    utxos.forEach((item: Item<Field>, index: number) => {
      fixedSizeUtxos[index] = item
    })
    const latestTree = this.latestUTXOTree()
    if (!latestTree) throw Error('Grove is not initialized')
    if (
      latestTree
        .latestLeafIndex()
        .add(totalItemLen)
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

  private async appendWithdrawals(withdrawals: BN[]): Promise<void> {
    const totalItemLen =
      this.config.withdrawalSubTreeSize *
      Math.ceil(withdrawals.length / this.config.withdrawalSubTreeSize)

    const fixedSizeWithdrawals: Item<BN>[] = Array(totalItemLen).fill({
      leafHash: new BN(0),
    })
    withdrawals.forEach((withdrawal: BN, index: number) => {
      fixedSizeWithdrawals[index] = {
        leafHash: withdrawal,
      }
    })
    const latestTree = this.latestWithdrawalTree()
    if (!latestTree) throw Error('Grove is not initialized')
    if (
      latestTree
        .latestLeafIndex()
        .addn(totalItemLen)
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
    nullifiers: BN[],
  ): Promise<void> {
    // only the full node manages the nullifier tree
    const tree = this.nullifierTree
    if (tree) {
      await tree.nullify(block, ...nullifiers)
    }
  }

  async utxoMerkleProof(hash: Field): Promise<MerkleProof<Field>> {
    const queryResult = await this.db
      .selectTable(schema.utxo.name)
      .query('select')
      .where(['hash', '=', hash.toHex()])
      .exec()
    const utxo: UtxoSql = queryResult.pop() as UtxoSql
    if (!utxo) throw Error('Failed to find the utxo')
    if (!utxo.tree) throw Error('It is not included in a block yet')
    if (!utxo.index) throw Error('It is not included in a block yet')

    const cachedSiblings = (await this.db
      .selectTable(schema.utxoTreeNode(utxo.tree).name)
      .presetQuery('getSiblings', {
        depth: this.config.utxoTreeDepth,
        index: utxo.index,
      })
      .exec()) as TreeNodeSql[]
    let root: Field = this.latestUTXOTree().root()
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
    const proof = {
      root,
      index: Field.from(utxo.index),
      leaf: Field.from(utxo.hash),
      siblings,
    }
    verifyProof(this.config.utxoHasher, proof)
    return proof
  }

  async withdrawalMerkleProof(hash: BN): Promise<MerkleProof<BN>> {
    const queryResult = await this.db
      .selectTable(schema.withdrawal.name)
      .query('select')
      .where(['hash', '=', hexify(hash)])
      .exec()
    const withdrawal: UtxoSql = queryResult.pop() as UtxoSql
    if (!withdrawal) throw Error('Failed to find the withdrawal')
    if (!withdrawal.tree) throw Error('It is not included in a block yet')
    if (!withdrawal.index) throw Error('It is not included in a block yet')

    const cachedSiblings = (await this.db
      .selectTable(schema.withdrawalTreeNode(withdrawal.tree).name)
      .presetQuery('getSiblings', {
        depth: this.config.withdrawalTreeDepth,
        index: withdrawal.index,
      })
      .exec()) as TreeNodeSql[]
    let root: BN = this.latestWithdrawalTree().root()
    const siblings = [...this.config.withdrawalHasher.preHash]
    cachedSiblings.forEach((obj: TreeNodeSql) => {
      const level =
        1 +
        this.config.withdrawalTreeDepth -
        toBN(obj.nodeIndex || 0).toString(2).length
      if (level === this.config.withdrawalTreeDepth) {
        root = toBN(obj.value)
      } else {
        siblings[level] = toBN(obj.value)
      }
    })
    const proof = {
      root,
      index: toBN(withdrawal.index),
      leaf: toBN(withdrawal.hash),
      siblings,
    }
    verifyProof(this.config.withdrawalHasher, proof)
    return proof
  }

  private async bootstrapUtxoTree(
    treeIndex: number,
    proof?: MerkleProof<Field>,
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
    // create if not exist
    const treeNodeNameTable = schema.utxoTreeNode(treeSql.id)
    const tables = await this.db.query('show tables').exec()
    if (!tables.find(obj => obj.table === treeNodeNameTable.name)) {
      await this.db.query('create table', treeNodeNameTable).exec()
    }
    return { treeSql, tree }
  }

  private async bootstrapWithdrawalTree(
    treeIndex: number,
    proof?: MerkleProof<BN>,
  ): Promise<{ treeSql: LightRollUpTreeSql; tree: WithdrawalTree }> {
    const hasher = this.config.withdrawalHasher
    let data: { root: string; index: string; siblings: string[] }
    if (proof) {
      data = {
        root: hexify(proof.root),
        index: hexify(proof.index),
        siblings: proof.siblings.map(sib => hexify(sib)),
      }
      if (!startingLeafProof(hasher, proof.root, proof.index, proof.siblings)) {
        throw Error('Invalid starting leaf proof')
      }
    } else {
      data = {
        root: hexify([...hasher.preHash].pop() as BN),
        index: hexify(new BN(0)),
        siblings: hasher.preHash.map(sib => hexify(sib)),
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
    // create if not exist
    const treeNodeNameTable = schema.withdrawalTreeNode(treeSql.id)
    const tables = await this.db.query('show tables').exec()
    if (!tables.find(obj => obj.table === treeNodeNameTable.name)) {
      await this.db.query('create table', treeNodeNameTable).exec()
    }
    return { treeSql, tree }
  }
}
