/* eslint-disable @typescript-eslint/camelcase */
import { Field, Point } from '@zkopru/babyjubjub'
import { logger, hexify } from '@zkopru/utils'
import AsyncLock from 'async-lock'
import BN from 'bn.js'
import { toBN } from 'web3-utils'
import { DB, TreeSpecies, LightTree, TreeNode } from '@zkopru/prisma'
import { Hasher, genesisRoot } from './hasher'
import { MerkleProof, verifyProof, startingLeafProof } from './merkle-proof'
import { Leaf } from './light-rollup-tree'
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
  utxos: Leaf<Field>[]
  withdrawals: Leaf<BN>[]
  nullifiers: Field[]
}

export interface GroveSnapshot {
  utxoTreeIndex: Field
  utxoTreeRoot: Field
  withdrawalTreeIndex: BN
  withdrawalTreeRoot: BN
  nullifierTreeRoot?: BN
}

export class Grove {
  lock: AsyncLock

  db: DB

  config: GroveConfig

  utxoTrees!: UtxoTree[]

  withdrawalTrees!: WithdrawalTree[]

  nullifierTree?: NullifierTree

  constructor(db: DB, config: GroveConfig) {
    this.lock = new AsyncLock()
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
    await this.lock.acquire('grove', async () => {
      const utxoTreeData = await this.db.read(prisma =>
        prisma.lightTree.findMany({
          where: { species: TreeSpecies.UTXO },
          orderBy: { treeIndex: 'asc' },
        }),
      )

      if (utxoTreeData.length === 0) {
        // start a new tree if there's no utxo tree
        const { treeSql } = await this.bootstrapUtxoTree(0)
        utxoTreeData.push(treeSql)
      }

      this.utxoTrees = utxoTreeData.map(data =>
        UtxoTree.from(this.db, data, {
          hasher: this.config.utxoHasher,
          forceUpdate: this.config.forceUpdate,
          fullSync: this.config.fullSync,
        }),
      )

      const withdrawalTreeData = await this.db.read(prisma =>
        prisma.lightTree.findMany({
          where: { species: TreeSpecies.WITHDRAWAL },
          orderBy: { treeIndex: 'asc' },
        }),
      )

      if (withdrawalTreeData.length === 0) {
        // start a new tree if there's no utxo tree
        const { treeSql } = await this.bootstrapWithdrawalTree(0)
        withdrawalTreeData.push(treeSql)
      }

      this.withdrawalTrees = withdrawalTreeData.map(data =>
        WithdrawalTree.from(this.db, data, {
          hasher: this.config.withdrawalHasher,
          forceUpdate: this.config.forceUpdate,
          fullSync: this.config.fullSync,
        }),
      )

      this.nullifierTree = new NullifierTree({
        db: this.db,
        hasher: this.config.nullifierHasher,
        depth: this.config.nullifierTreeDepth,
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

  async applyGrovePatch(
    patch: GrovePatch,
  ): Promise<{
    utxoTreeId: string
    withdrawalTreeId: string
  }> {
    let utxoTreeId!: string
    let withdrawalTreeId!: string
    await this.lock.acquire('grove', async () => {
      utxoTreeId = await this.appendUTXOs(patch.utxos)
      withdrawalTreeId = await this.appendWithdrawals(patch.withdrawals)
      await this.markAsNullified(patch.nullifiers)
      if (this.config.fullSync) {
        await this.recordBootstrap(patch.header)
      }
    })
    return {
      utxoTreeId,
      withdrawalTreeId,
    }
  }

  async dryPatch(patch: GrovePatch): Promise<GroveSnapshot> {
    return new Promise<GroveSnapshot>((res, rej) => {
      let result!: GroveSnapshot
      this.lock
        .acquire('grove', async () => {
          const utxoResult = await this.latestUTXOTree().dryAppend(
            ...patch.utxos.map(leaf => ({ ...leaf, shouldTrack: false })),
          )
          const withdrawalResult = await this.latestWithdrawalTree().dryAppend(
            ...patch.withdrawals.map(leaf => ({ ...leaf, shouldTrack: false })),
          )
          const nullifierRoot = await this.nullifierTree?.dryRunNullify(
            ...patch.nullifiers,
          )
          const utxoFixedSizeLen =
            this.config.utxoSubTreeSize *
            Math.ceil(patch.utxos.length / this.config.utxoSubTreeSize)
          const withdrawalFixedSizeLen =
            this.config.withdrawalSubTreeSize *
            Math.ceil(
              patch.withdrawals.length / this.config.withdrawalSubTreeSize,
            )

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
          return result
        })
        .then(res)
        .catch(rej)
    })
  }

  private async recordBootstrap(header?: string): Promise<void> {
    const bootstrapData = {
      utxoTreeIndex: this.latestUTXOTree().metadata.index,
      utxoBootstrap: JSON.stringify(
        this.latestUTXOTree().data.siblings.map(val => hexify(val)),
      ),
      withdrawalTreeIndex: this.latestWithdrawalTree().metadata.index,
      withdrawalBootstrap: JSON.stringify(
        this.latestWithdrawalTree().data.siblings.map(val => hexify(val)),
      ),
    }
    if (header) {
      await this.db.write(prisma =>
        prisma.bootstrap.upsert({
          where: { blockHash: header },
          update: bootstrapData,
          create: {
            ...bootstrapData,
            block: {
              connect: { hash: header },
            },
          },
        }),
      )
    } else {
      await this.db.write(prisma =>
        prisma.bootstrap.create({ data: bootstrapData }),
      )
    }
  }

  /**
   *
   * @param utxos utxos to append
   * @returns treeId of appended to
   */
  private async appendUTXOs(utxos: Leaf<Field>[]): Promise<string> {
    const totalItemLen =
      this.config.utxoSubTreeSize *
      Math.ceil(utxos.length / this.config.utxoSubTreeSize)

    const fixedSizeUtxos: Leaf<Field>[] = Array(totalItemLen).fill({
      hash: Field.zero,
    })
    utxos.forEach((item: Leaf<Field>, index: number) => {
      fixedSizeUtxos[index] = item
    })
    const latestTree = this.latestUTXOTree()
    if (!latestTree) throw Error('Grove is not initialized')
    let treeId: string
    if (
      latestTree
        .latestLeafIndex()
        .add(totalItemLen)
        .lt(latestTree.maxSize())
    ) {
      await latestTree.append(...fixedSizeUtxos)
      treeId = latestTree.metadata.id
    } else {
      const { tree } = await this.bootstrapUtxoTree(
        latestTree.metadata.index + 1,
      )
      this.utxoTrees.push(tree)
      await tree.append(...fixedSizeUtxos)
      treeId = tree.metadata.id
    }
    return treeId
  }

  private async appendWithdrawals(withdrawals: Leaf<BN>[]): Promise<string> {
    const totalItemLen =
      this.config.withdrawalSubTreeSize *
      Math.ceil(withdrawals.length / this.config.withdrawalSubTreeSize)

    const fixedSizeWithdrawals: Leaf<BN>[] = Array(totalItemLen).fill({
      hash: new BN(0),
    })
    withdrawals.forEach((withdrawal: Leaf<BN>, index: number) => {
      fixedSizeWithdrawals[index] = withdrawal
    })
    const latestTree = this.latestWithdrawalTree()
    if (!latestTree) throw Error('Grove is not initialized')
    let treeId: string
    if (
      latestTree
        .latestLeafIndex()
        .addn(totalItemLen)
        .lt(latestTree.maxSize())
    ) {
      await latestTree.append(...fixedSizeWithdrawals)
      treeId = latestTree.metadata.id
    } else {
      const { tree } = await this.bootstrapWithdrawalTree(
        latestTree.metadata.index + 1,
      )
      this.withdrawalTrees.push(tree)
      await tree.append(...fixedSizeWithdrawals)
      treeId = tree.metadata.id
    }
    return treeId
  }

  private async markAsNullified(nullifiers: BN[]): Promise<void> {
    // only the full node manages the nullifier tree
    const tree = this.nullifierTree
    if (tree) {
      await tree.nullify(...nullifiers)
    }
  }

  async utxoMerkleProof(hash: Field): Promise<MerkleProof<Field>> {
    const utxo = await this.db.read(prisma =>
      prisma.utxo.findOne({
        where: { hash: hash.toString(10) },
        include: { tree: true },
      }),
    )
    if (!utxo) throw Error('Failed to find the utxo')
    if (!utxo.tree) throw Error('It is not included in a block yet')
    if (!utxo.index) throw Error('It is not included in a block yet')

    const cachedSiblings = await this.db.preset.getCachedSiblings(
      this.config.utxoTreeDepth,
      utxo.tree.id,
      utxo.index,
    )
    let root: Field = this.latestUTXOTree().root()
    const siblings = [...this.config.utxoHasher.preHash]
    cachedSiblings.forEach((obj: TreeNode) => {
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
    const isValid = verifyProof(this.config.utxoHasher, proof)
    if (!isValid) throw Error('Failed to generate utxo merkle proof')
    return proof
  }

  async withdrawalMerkleProof(hash: BN): Promise<MerkleProof<BN>> {
    const withdrawal = await this.db.read(prisma =>
      prisma.withdrawal.findOne({
        where: { hash: hash.toString(10) },
        include: { tree: true },
      }),
    )
    if (!withdrawal) throw Error('Failed to find the withdrawal')
    if (!withdrawal.tree) throw Error('It is not included in a block yet')
    if (!withdrawal.index) throw Error('It is not included in a block yet')

    const cachedSiblings = await this.db.preset.getCachedSiblings(
      this.config.withdrawalTreeDepth,
      withdrawal.tree.id,
      withdrawal.index,
    )
    let root: BN = this.latestWithdrawalTree().root()
    const siblings = [...this.config.withdrawalHasher.preHash]
    cachedSiblings.forEach((obj: TreeNode) => {
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
      leaf: toBN(withdrawal.withdrawalHash),
      siblings,
    }
    const isValid = verifyProof(this.config.withdrawalHasher, proof)
    if (!isValid) throw Error('Failed to generate withdrawal merkle proof')
    return proof
  }

  private async bootstrapUtxoTree(
    treeIndex: number,
    proof?: MerkleProof<Field>,
  ): Promise<{ treeSql: LightTree; tree: UtxoTree }> {
    const hasher = this.config.utxoHasher
    let root: Field
    let index: Field
    let siblings: Field[]

    if (proof) {
      root = proof.root
      index = proof.index
      siblings = proof.siblings
      if (!startingLeafProof(hasher, proof.root, proof.index, proof.siblings)) {
        throw Error('Invalid starting leaf proof')
      }
    } else {
      root = genesisRoot(hasher)
      index = Field.zero
      siblings = hasher.preHash
    }
    const data = {
      root: root.toString(10),
      index: index.toString(10),
      siblings: JSON.stringify(siblings.map(f => f.toString(10))),
      start: index.toString(10),
      end: index.toString(10),
    }
    const treeSql = await this.db.write(prisma =>
      prisma.lightTree.upsert({
        where: {
          species_treeIndex: {
            species: TreeSpecies.UTXO,
            treeIndex,
          },
        },
        update: {
          species: TreeSpecies.UTXO,
          treeIndex,
          ...data,
        },
        create: {
          species: TreeSpecies.UTXO,
          treeIndex,
          ...data,
        },
      }),
    )
    const tree = UtxoTree.from(this.db, treeSql, {
      hasher: this.config.utxoHasher,
      forceUpdate: this.config.forceUpdate,
      fullSync: this.config.fullSync,
    })
    return { treeSql, tree }
  }

  private async bootstrapWithdrawalTree(
    treeIndex: number,
    proof?: MerkleProof<BN>,
  ): Promise<{ treeSql: LightTree; tree: WithdrawalTree }> {
    const hasher = this.config.withdrawalHasher
    let root: BN
    let index: BN
    let siblings: BN[]

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
      index = new BN(0)
      siblings = hasher.preHash
    }
    const data = {
      root: hexify(root),
      index: index.toString(10),
      siblings: JSON.stringify(siblings.map(val => hexify(val))),
      start: index.toString(10),
      end: index.toString(10),
    }
    const treeSql = await this.db.write(prisma =>
      prisma.lightTree.upsert({
        where: {
          species_treeIndex: {
            species: TreeSpecies.WITHDRAWAL,
            treeIndex,
          },
        },
        update: {
          species: TreeSpecies.WITHDRAWAL,
          treeIndex,
          ...data,
        },
        create: {
          species: TreeSpecies.WITHDRAWAL,
          treeIndex,
          ...data,
        },
      }),
    )
    const tree = WithdrawalTree.from(this.db, treeSql, {
      hasher: this.config.withdrawalHasher,
      forceUpdate: this.config.forceUpdate,
      fullSync: this.config.fullSync,
    })
    return { treeSql, tree }
  }
}
