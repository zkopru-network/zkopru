/* eslint-disable @typescript-eslint/camelcase */
import { Field } from '@zkopru/babyjubjub'
import { logger, hexify } from '@zkopru/utils'
import AsyncLock from 'async-lock'
import BN from 'bn.js'
import { toBN } from 'web3-utils'
import assert from 'assert'
import { DB, TreeSpecies, LightTree, TreeNode } from '@zkopru/prisma'
import { ZkAddress } from '@zkopru/transaction'
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
  zkAddressesToObserve: ZkAddress[]
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

  utxoTree!: UtxoTree

  withdrawalTree!: WithdrawalTree

  nullifierTree?: NullifierTree

  constructor(db: DB, config: GroveConfig) {
    this.lock = new AsyncLock()
    this.config = config
    this.db = db
  }

  async applyBootstrap({
    utxoStartingLeafProof,
    withdrawalStartingLeafProof,
  }: {
    utxoStartingLeafProof: MerkleProof<Field>
    withdrawalStartingLeafProof: MerkleProof<BN>
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
      let utxoTreeData = await this.db.read(prisma =>
        prisma.lightTree.findOne({
          where: { species: TreeSpecies.UTXO },
        }),
      )

      if (utxoTreeData === null) {
        // start a new tree if there's no utxo tree
        const { treeSql } = await this.bootstrapUtxoTree()
        utxoTreeData = treeSql
      }
      assert(utxoTreeData)

      this.utxoTree = UtxoTree.from(this.db, utxoTreeData, {
        hasher: this.config.utxoHasher,
        forceUpdate: this.config.forceUpdate,
        fullSync: this.config.fullSync,
      })

      let withdrawalTreeData = await this.db.read(prisma =>
        prisma.lightTree.findOne({
          where: { species: TreeSpecies.WITHDRAWAL },
        }),
      )

      if (withdrawalTreeData === null) {
        // start a new tree if there's no utxo tree
        const { treeSql } = await this.bootstrapWithdrawalTree()
        withdrawalTreeData = treeSql
      }
      assert(withdrawalTreeData)

      this.withdrawalTree = WithdrawalTree.from(this.db, withdrawalTreeData, {
        hasher: this.config.withdrawalHasher,
        forceUpdate: this.config.forceUpdate,
        fullSync: this.config.fullSync,
      })

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
          const utxoResult = await this.utxoTree.dryAppend(
            ...patch.utxos.map(leaf => ({ ...leaf, shouldTrack: false })),
          )
          const withdrawalResult = await this.withdrawalTree.dryAppend(
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
      utxoBootstrap: JSON.stringify(
        this.utxoTree.data.siblings.map(val => hexify(val)),
      ),
      withdrawalBootstrap: JSON.stringify(
        this.withdrawalTree.data.siblings.map(val => hexify(val)),
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
    if (!this.utxoTree) throw Error('Grove is not initialized')
    if (
      this.utxoTree
        .latestLeafIndex()
        .add(totalItemLen)
        .lte(this.utxoTree.maxSize())
    ) {
      await this.utxoTree.append(...fixedSizeUtxos)
    } else {
      throw Error('utxo tree flushes.')
    }
    return this.utxoTree.metadata.id
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
    if (!this.withdrawalTree) throw Error('Grove is not initialized')
    if (
      this.withdrawalTree
        .latestLeafIndex()
        .addn(totalItemLen)
        .lte(this.withdrawalTree.maxSize())
    ) {
      await this.withdrawalTree.append(...fixedSizeWithdrawals)
    } else {
      throw Error('withdrawal tree flushes')
    }
    return this.withdrawalTree.metadata.id
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
      }),
    )
    if (!utxo) throw Error('Failed to find the utxo')
    if (!utxo.index) throw Error('It is not included in a block yet')

    const cachedSiblings = await this.db.preset.getCachedSiblings(
      this.config.utxoTreeDepth,
      this.utxoTree.metadata.id,
      utxo.index,
    )
    let root: Field = this.utxoTree.root()
    const siblings = [...this.config.utxoHasher.preHash.slice(0, -1)]
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

  async withdrawalMerkleProof(
    noteHash: BN,
    index?: BN,
  ): Promise<MerkleProof<BN>> {
    const withdrawal = await this.db.read(prisma =>
      prisma.withdrawal.findOne({
        where: { hash: noteHash.toString(10) },
      }),
    )
    if (!withdrawal) throw Error('Failed to find the withdrawal')
    const leafIndex = index?.toString() || withdrawal.index
    if (!leafIndex) throw Error('It is not included in a block yet')

    const cachedSiblings = await this.db.preset.getCachedSiblings(
      this.config.withdrawalTreeDepth,
      this.withdrawalTree.metadata.id,
      leafIndex,
    )
    let root: BN = this.withdrawalTree.root()
    const siblings = [...this.config.withdrawalHasher.preHash.slice(0, -1)]
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
      index: toBN(leafIndex),
      leaf: toBN(withdrawal.withdrawalHash),
      siblings,
    }
    const isValid = verifyProof(this.config.withdrawalHasher, proof)
    if (!isValid) throw Error('Failed to generate withdrawal merkle proof')
    return proof
  }

  private async bootstrapUtxoTree(
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
      siblings = hasher.preHash.slice(0, -1)
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
        where: { species: TreeSpecies.UTXO },
        update: { ...data },
        create: { species: TreeSpecies.UTXO, ...data },
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
      siblings = hasher.preHash.slice(0, -1)
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
        where: { species: TreeSpecies.WITHDRAWAL },
        update: { ...data },
        create: { species: TreeSpecies.WITHDRAWAL, ...data },
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
