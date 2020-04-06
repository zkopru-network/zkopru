import { nanoSQL } from '@nano-sql/core'
import {
  TreeSqlObj,
  schema,
  MerkleProofCacheSqlObject,
  OutputSqlObject,
} from '@zkopru/database'
import { Field, Point } from '@zkopru/babyjubjub'
import {
  LightRollUpTree,
  MerkleProof,
  TreeType,
  Item,
  Hasher,
  merkleProof,
} from '@zkopru/tree'
import { InanoSQLQueryBuilder } from '@nano-sql/core/lib/interfaces'

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

export class Grove {
  zkopruId: string

  db: nanoSQL

  config: GroveConfig

  utxoTrees!: LightRollUpTree[]

  withdrawalTrees!: LightRollUpTree[]

  nullifierTree!: LightRollUpTree

  constructor(zkopruId: string, db: nanoSQL, config: GroveConfig) {
    this.zkopruId = zkopruId
    this.config = config
    this.db = db
  }

  async init() {
    const trees = (await this.db
      .selectTable(schema.tree.name)
      .query('select')
      .where(['zkopru', '=', this.zkopruId])
      .exec()) as TreeSqlObj[]

    const utxoTreeSqlObjs = trees
      .filter(tree => tree.type === TreeType.UTXO)
      .sort((a, b) => a.index - b.index)

    const withdrawalTreeSqlObjs = trees
      .filter(tree => tree.type === TreeType.WITHDRAWAL)
      .sort((a, b) => a.index - b.index)

    const nullifierTreeSqlObjs = trees
      .filter(tree => tree.type === TreeType.NULLIFIER)
      .sort((a, b) => a.index - b.index)

    if (utxoTreeSqlObjs.length === 0) {
      // start a new tree if there's no utxo tree
      const queryResult = (await this.initNewTreeQuery(
        TreeType.UTXO,
      ).exec()) as TreeSqlObj[]
      utxoTreeSqlObjs.push(...queryResult)
    }

    if (withdrawalTreeSqlObjs.length === 0) {
      // start a new tree if there's no withdrawal tree
      const queryResult = (await this.initNewTreeQuery(
        TreeType.WITHDRAWAL,
      ).exec()) as TreeSqlObj[]
      withdrawalTreeSqlObjs.push(...queryResult)
    }

    if (nullifierTreeSqlObjs.length === 0) {
      // start a new tree if there's no nullifier tree
      const queryResult = (await this.initNewTreeQuery(
        TreeType.NULLIFIER,
      ).exec()) as TreeSqlObj[]
      nullifierTreeSqlObjs.push(...queryResult)
    }

    if (nullifierTreeSqlObjs.length !== 1)
      throw Error('You have more than 1 nullifier tree')

    this.utxoTrees = utxoTreeSqlObjs.map(this.toRollUpTree)
    this.withdrawalTrees = withdrawalTreeSqlObjs.map(this.toRollUpTree)
    this.nullifierTree = nullifierTreeSqlObjs
      .map(this.toRollUpTree)
      .pop() as LightRollUpTree
  }

  latestUTXOTree(): LightRollUpTree {
    return this.utxoTrees[this.utxoTrees.length - 1]
  }

  latestWithdrawalTree(): LightRollUpTree {
    return this.withdrawalTrees[this.withdrawalTrees.length - 1]
  }

  async appendUTXOs(...utxos: Item[]): Promise<void> {
    const fixedSizeUtxos: Item[] = Array(this.config.utxoSubTreeSize).fill({
      leafHash: Field.zero,
    })
    utxos.forEach((item: Item, index: number) => {
      fixedSizeUtxos[index] = item
    })
    const tree = this.latestUTXOTree()
    if (!tree) throw Error('Grove is not initialized')
    if (
      tree
        .latestLeafIndex()
        .add(this.config.utxoSubTreeSize)
        .lt(tree.maxSize())
    ) {
      await tree.append(...fixedSizeUtxos)
    } else {
      const newTree = await this.initNewTree(TreeType.UTXO)
      this.utxoTrees.push(newTree)
      await newTree.append(...fixedSizeUtxos)
    }
  }

  async appendWithdrawals(...withdrawals: Field[]): Promise<void> {
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
    const tree = this.latestWithdrawalTree()
    if (!tree) throw Error('Grove is not initialized')
    if (
      tree
        .latestLeafIndex()
        .add(this.config.withdrawalSubTreeSize)
        .lt(tree.maxSize())
    ) {
      await tree.append(...fixedSizeWithdrawals)
    } else {
      const newTree = await this.initNewTree(TreeType.WITHDRAWAL)
      this.withdrawalTrees.push(newTree)
      await newTree.append(...fixedSizeWithdrawals)
    }
  }

  async markAsNullified(...nullifiers: Field[]): Promise<void> {
    const tree = this.nullifierTree
    if (!tree) throw Error('Grove is not initialized')
    await tree.append(...nullifiers.map(nullifier => ({ leafHash: nullifier })))
  }

  async utxoMerkleProof(hash: Field): Promise<MerkleProof> {
    const queryResult = await this.db
      .selectTable(schema.output.name)
      .query('select')
      .where(['hash', '=', hash.toHex()])
      .exec()
    const output: OutputSqlObject = queryResult.pop() as OutputSqlObject
    if (!output) throw Error('Failed to find the utxo')

    const cachedSiblings = (await this.db
      .selectTable(schema.merkleProofCache(output.tree).name)
      .presetQuery('getSiblings', {
        depth: this.config.utxoTreeDepth,
        index: output.index,
      })
      .exec()) as MerkleProofCacheSqlObject[]
    let root!: Field
    const siblings = [...this.config.utxoHasher.preHash]
    cachedSiblings.forEach((obj: MerkleProofCacheSqlObject) => {
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
      index: Field.from(output.index),
      leaf: Field.from(output.hash),
      siblings,
    }
    merkleProof(this.config.utxoHasher, proof)
    return proof
  }

  async withdrawalMerkleProof(
    withdrawal: OutputSqlObject,
  ): Promise<MerkleProof> {
    const cachedSiblings = (await this.db
      .selectTable(schema.merkleProofCache(withdrawal.tree).name)
      .presetQuery('getSiblings', {
        depth: this.config.withdrawalTreeDepth,
        index: withdrawal.index,
      })
      .exec()) as MerkleProofCacheSqlObject[]
    let root!: Field
    const siblings = [...this.config.withdrawalHasher.preHash]
    cachedSiblings.forEach((obj: MerkleProofCacheSqlObject) => {
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
    merkleProof(this.config.utxoHasher, proof)
    return proof
  }

  private async initNewTree(treeType: TreeType): Promise<LightRollUpTree> {
    const query = this.initNewTreeQuery(treeType)
    const sqlResult = (await query.exec()).pop() as TreeSqlObj
    return this.toRollUpTree(sqlResult)
  }

  private initNewTreeQuery(treeType: TreeType): InanoSQLQueryBuilder {
    let hasher: Hasher
    switch (treeType) {
      case TreeType.UTXO:
        hasher = this.config.utxoHasher
        break
      case TreeType.WITHDRAWAL:
        hasher = this.config.withdrawalHasher
        break
      case TreeType.NULLIFIER:
        hasher = this.config.nullifierHasher
        break
      default:
        throw Error('Not supported type of tree')
    }
    return this.db.selectTable(schema.tree.name).presetQuery('bootstrapTree', {
      index: 0,
      type: treeType,
      zkopru: this.zkopruId,
      data: {
        root: ([...hasher.preHash].pop() as Field).toHex(),
        index: Field.zero.toHex(),
        siblings: hasher.preHash.map(f => f.toHex()),
      },
    })
  }

  private toRollUpTree(obj: TreeSqlObj): LightRollUpTree {
    return new LightRollUpTree({
      db: this.db,
      metadata: {
        id: obj.id,
        type: obj.type,
        index: obj.index,
        zkopruId: obj.zkopru,
        start: Field.from(obj.start),
        end: Field.from(obj.end),
      },
      data: {
        root: Field.from(obj.data.root),
        index: Field.from(obj.data.index),
        siblings: obj.data.siblings.map(sib => Field.from(sib)),
      },
      config: {
        hasher: this.config.utxoHasher,
        fullSync: this.config.fullSync,
        forceUpdate: this.config.forceUpdate,
        pubKeysToObserve: this.config.pubKeysToObserve,
        addressesToObserve: this.config.addressesToObserve,
      },
    })
  }
}
