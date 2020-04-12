import { InanoSQLInstance } from '@nano-sql/core'
import {
  TreeSql,
  schema,
  MerkleProofCacheSql,
  OutputSql,
} from '@zkopru/database'
import { Field, Point } from '@zkopru/babyjubjub'
import { Hasher } from './hasher'
import {
  LightRollUpTree,
  TreeType,
  Item,
  MerkleProof,
  merkleProof,
} from './tree'

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

  db: InanoSQLInstance

  config: GroveConfig

  utxoTrees!: LightRollUpTree[]

  withdrawalTrees!: LightRollUpTree[]

  nullifierTree?: LightRollUpTree

  constructor(zkopruId: string, db: InanoSQLInstance, config: GroveConfig) {
    this.zkopruId = zkopruId
    this.config = config
    this.db = db
  }

  async applyBootstrap({
    utxoTreeIndex,
    utxoTreeBootstrap,
    withdrawalTreeIndex,
    withdrawalTreeBootstrap,
  }: {
    utxoTreeIndex: number
    utxoTreeBootstrap: MerkleProof
    withdrawalTreeIndex: number
    withdrawalTreeBootstrap: MerkleProof
  }) {
    await this.bootstrapTree(utxoTreeIndex, TreeType.UTXO, utxoTreeBootstrap)
    await this.bootstrapTree(
      withdrawalTreeIndex,
      TreeType.WITHDRAWAL,
      withdrawalTreeBootstrap,
    )
  }

  async init() {
    const trees = (await this.db
      .selectTable(schema.tree.name)
      .query('select')
      .where(['zkopru', '=', this.zkopruId])
      .exec()) as TreeSql[]

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
      const { treeSql } = await this.bootstrapTree(0, TreeType.UTXO)
      utxoTreeSqlObjs.push(treeSql)
    }

    if (withdrawalTreeSqlObjs.length === 0) {
      // start a new tree if there's no withdrawal tree
      const { treeSql } = await this.bootstrapTree(0, TreeType.WITHDRAWAL)
      withdrawalTreeSqlObjs.push(treeSql)
    }

    if (nullifierTreeSqlObjs.length === 0) {
      // start a new tree if there's no nullifier tree
      const { treeSql } = await this.bootstrapTree(0, TreeType.NULLIFIER)
      nullifierTreeSqlObjs.push(treeSql)
    }

    if (nullifierTreeSqlObjs.length > 1)
      throw Error('You have more than 1 nullifier tree')

    this.utxoTrees = utxoTreeSqlObjs.map(this.toRollUpTree)
    this.withdrawalTrees = withdrawalTreeSqlObjs.map(this.toRollUpTree)
    this.nullifierTree = nullifierTreeSqlObjs
      .map(this.toRollUpTree)
      .pop() as LightRollUpTree
  }

  setPubKeysToObserve(points: Point[]) {
    this.config.pubKeysToObserve = points
    this.utxoTrees.forEach(tree => tree.updatePubKeys(points))
    this.withdrawalTrees.forEach(tree => tree.updatePubKeys(points))
  }

  setAddressesToObserve(addresses: string[]) {
    this.config.addressesToObserve = addresses
    this.utxoTrees.forEach(tree => tree.updateAddresses(addresses))
    this.withdrawalTrees.forEach(tree => tree.updateAddresses(addresses))
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
      const { tree } = await this.bootstrapTree(
        latestTree.metadata.index,
        TreeType.UTXO,
      )
      this.utxoTrees.push(tree)
      await tree.append(...fixedSizeUtxos)
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
      const { tree } = await this.bootstrapTree(
        latestTree.metadata.index,
        TreeType.WITHDRAWAL,
      )
      this.withdrawalTrees.push(tree)
      await tree.append(...fixedSizeWithdrawals)
    }
  }

  async markAsNullified(...nullifiers: Field[]): Promise<void> {
    // only the full node manages the nullifier tree
    const tree = this.nullifierTree
    if (tree) {
      await tree.append(
        ...nullifiers.map(nullifier => ({ leafHash: nullifier })),
      )
    }
  }

  async utxoMerkleProof(hash: Field): Promise<MerkleProof> {
    const queryResult = await this.db
      .selectTable(schema.output.name)
      .query('select')
      .where(['hash', '=', hash.toHex()])
      .exec()
    const output: OutputSql = queryResult.pop() as OutputSql
    if (!output) throw Error('Failed to find the utxo')

    const cachedSiblings = (await this.db
      .selectTable(schema.merkleProofCache(output.tree).name)
      .presetQuery('getSiblings', {
        depth: this.config.utxoTreeDepth,
        index: output.index,
      })
      .exec()) as MerkleProofCacheSql[]
    let root!: Field
    const siblings = [...this.config.utxoHasher.preHash]
    cachedSiblings.forEach((obj: MerkleProofCacheSql) => {
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

  async withdrawalMerkleProof(withdrawal: OutputSql): Promise<MerkleProof> {
    const cachedSiblings = (await this.db
      .selectTable(schema.merkleProofCache(withdrawal.tree).name)
      .presetQuery('getSiblings', {
        depth: this.config.withdrawalTreeDepth,
        index: withdrawal.index,
      })
      .exec()) as MerkleProofCacheSql[]
    let root!: Field
    const siblings = [...this.config.withdrawalHasher.preHash]
    cachedSiblings.forEach((obj: MerkleProofCacheSql) => {
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

  private async bootstrapTree(
    treeIndex: number,
    treeType: TreeType,
    merkleProof?: MerkleProof,
  ): Promise<{ treeSql: TreeSql; tree: LightRollUpTree }> {
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
    let data: { root: string; index: string; siblings: string[] }
    if (merkleProof) {
      data = {
        root: merkleProof.root.toHex(),
        index: merkleProof.index.toHex(),
        siblings: merkleProof.siblings.map(s => s.toHex()),
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
        .selectTable(schema.tree.name)
        .presetQuery('bootstrapTree', {
          index: treeIndex,
          type: treeType,
          zkopru: this.zkopruId,
          data,
        })
        .exec()
    ).pop() as TreeSql
    return { treeSql, tree: this.toRollUpTree(treeSql) }
  }

  // private initNewTreeQuery(treeType: TreeType): InanoSQLQueryBuilder {
  //   let hasher: Hasher
  //   switch (treeType) {
  //     case TreeType.UTXO:
  //       hasher = this.config.utxoHasher
  //       break
  //     case TreeType.WITHDRAWAL:
  //       hasher = this.config.withdrawalHasher
  //       break
  //     case TreeType.NULLIFIER:
  //       hasher = this.config.nullifierHasher
  //       break
  //     default:
  //       throw Error('Not supported type of tree')
  //   }
  //   return this.db.selectTable(schema.tree.name).presetQuery('genesisTree', {
  //     index: 0,
  //     type: treeType,
  //     zkopru: this.zkopruId,
  //     data: {
  //       root: ([...hasher.preHash].pop() as Field).toHex(),
  //       index: Field.zero.toHex(),
  //       siblings: hasher.preHash.map(f => f.toHex()),
  //     },
  //   })
  // }

  private toRollUpTree(obj: TreeSql): LightRollUpTree {
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
