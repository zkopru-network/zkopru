/* eslint-disable @typescript-eslint/camelcase */
/* eslint-disable no-underscore-dangle */
import { Fp } from '@zkopru/babyjubjub'
import AsyncLock from 'async-lock'
import { DB, TreeSpecies, TransactionDB } from '@zkopru/database'
import { BigNumber } from 'ethers'
import { Hasher } from './hasher'
import { MerkleProof, startingLeafProof, verifyProof } from './merkle-proof'
import { TreeCache } from './utils'

export interface Leaf<T extends Fp | BigNumber> {
  hash: T
  noteHash?: Fp
  shouldTrack?: boolean
}

export interface TreeMetadata<T extends Fp | BigNumber> {
  id: string
  species: number
  start: T
  end: T
}

export interface TreeData<T extends Fp | BigNumber> {
  root: T
  index: T
  siblings: T[]
}

export interface TreeConfig<T extends Fp | BigNumber> {
  hasher: Hasher<T>
  forceUpdate?: boolean
  fullSync?: boolean
}

export abstract class LightRollUpTree<T extends Fp | BigNumber> {
  zero?: T

  species: TreeSpecies

  db: DB

  config: TreeConfig<T>

  metadata: TreeMetadata<T>

  data: TreeData<T>

  depth: number

  lock: AsyncLock

  treeCache: TreeCache

  constructor({
    db,
    species,
    metadata,
    data,
    config,
    treeCache,
  }: {
    db: DB
    species: TreeSpecies
    metadata: TreeMetadata<T>
    data: TreeData<T>
    config: TreeConfig<T>
    treeCache: TreeCache
  }) {
    this.lock = new AsyncLock()
    this.species = species
    this.db = db
    this.metadata = metadata
    this.data = data
    this.config = config
    this.depth = data.siblings.length
    this.treeCache = treeCache
  }

  root(): T {
    return this.data.root
  }

  maxSize(): BigNumber {
    return BigNumber.from(1).shl(this.depth)
  }

  latestLeafIndex(): T {
    return this.data.index
  }

  siblings(): T[] {
    return [...this.data.siblings].slice(0, this.depth)
  }

  async init() {
    const saveResult = await this.db.create('LightTree', {
      species: this.species,
      start: this.metadata.start.toString(),
      end: this.metadata.end.toString(),
      root:
        this.data.root instanceof Fp
          ? this.data.root.toString()
          : this.data.root.toHexString(),
      index: this.data.index.toString(),
      siblings: JSON.stringify(
        this.data.siblings.map(sib =>
          sib instanceof Fp ? sib.toString() : sib.toHexString(),
        ),
      ),
    })
    this.metadata.id = saveResult.id
  }

  async merkleProof({
    hash,
    index,
  }: {
    hash: T
    index?: T
  }): Promise<MerkleProof<T>> {
    return this.lock.acquire('root', async () =>
      this._merkleProof({ hash, index }),
    )
  }

  async append(
    items: Leaf<T>[],
    db: TransactionDB,
  ): Promise<{
    root: T
    index: T
    siblings: T[]
  }> {
    return this.lock.acquire('root', async () => this._append(items, db))
  }

  async dryAppend(
    items: Leaf<T>[],
  ): Promise<{
    root: T
    index: T
    siblings: T[]
  }> {
    return this.lock.acquire('root', async () => {
      const start = this.latestLeafIndex()
      const latestSiblings = this.siblings()
      let root: T = this.root()

      let index = start
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i]
        // if note exists, save the data and mark as an item to keep tracking
        // udpate the latest siblings and save the intermediate value if it needs to be tracked
        const leafIndex = BigNumber.from(1)
          .shl(this.depth)
          .or(index)
        let node = item.hash
        let hasRightSibling!: boolean
        for (let level = 0; level < this.depth; level += 1) {
          const pathIndex = leafIndex.shr(level)
          hasRightSibling = pathIndex.and(1).isZero()
          if (hasRightSibling) {
            // right empty sibling
            latestSiblings[level] = node // current node will be the next merkle proof's left sibling
            node = this.config.hasher.parentOf(
              node,
              this.config.hasher.preHash[level],
            )
          } else {
            // left sibling
            // keep current sibling
            node = this.config.hasher.parentOf(latestSiblings[level], node)
          }
        }
        // update root
        root = node
        // update index
        if (this.zero instanceof Fp) {
          index = Fp.from(index.add(1)) as T
        } else {
          index = index.add(1) as T
        }
      }
      // update the latest siblings
      return {
        root,
        index,
        siblings: latestSiblings,
      }
    })
  }

  async getStartingLeafProof(): Promise<{
    root: T
    index: T
    siblings: T[]
  }> {
    return this.lock.acquire('root', async () => {
      const index = this.latestLeafIndex()
      const siblings: T[] = [...this.data.siblings]
      let path: BigNumber = index
      for (let i = 0; i < this.depth; i += 1) {
        if (path.and(1).isZero()) {
          siblings[i] = this.config.hasher.preHash[i]
        }
        path = path.shr(1)
      }
      return {
        root: this.root(),
        index,
        siblings,
      }
    })
  }

  private async _merkleProof({
    hash,
    index,
  }: {
    hash: T
    index?: T
  }): Promise<MerkleProof<T>> {
    let leafIndex: T
    if (index) {
      leafIndex = index
    } else {
      const leafCandidates = await this.db.findMany('TreeNode', {
        where: {
          value: hash.toHexString(),
          treeId: this.metadata.id,
        },
        limit: 1,
      })
      if (leafCandidates.length === 0) throw Error('Leaf does not exist.')
      else if (leafCandidates.length > 1)
        throw Error('Multiple leaves exist for same hash.')
      else {
        const leafNodeIndex: BigNumber = BigNumber.from(
          leafCandidates[0].nodeIndex,
        )
        const prefix = BigNumber.from(1).shl(this.depth)
        if (this.zero instanceof Fp) {
          leafIndex = Fp.from(leafNodeIndex.xor(prefix)) as T
        } else {
          leafIndex = leafNodeIndex.xor(prefix) as T
        }
      }
    }
    const siblings = await this._getSiblings(leafIndex)
    const root = this.root()
    const proof = {
      root,
      index: leafIndex,
      leaf: hash,
      siblings,
    }
    if (!verifyProof(this.config.hasher, proof)) {
      throw Error('Created invalid merkle proof')
    }
    return proof
  }

  private async _getSiblings(leafIndex: T): Promise<T[]> {
    const cachedSiblings = await this._getCachedSiblings(leafIndex)
    const siblings = Array(this.depth).fill(undefined)
    const leafNodeIndex = BigNumber.from(1)
      .shl(this.depth)
      .or(leafIndex)
    let pathNodeIndex!: BigNumber
    let siblingNodeIndex!: BigNumber
    for (let level = 0; level < this.depth; level += 1) {
      pathNodeIndex = leafNodeIndex.shr(level)
      siblingNodeIndex = BigNumber.from(1).xor(pathNodeIndex)
      const usePreHashed: boolean = siblingNodeIndex.gt(
        BigNumber.from(1)
          .shl(this.depth)
          .or(this.metadata.end)
          .shr(level),
      )
      if (usePreHashed) {
        // should return pre hashed zero
        siblings[level] = this.config.hasher.preHash[level]
      } else {
        // should find the node value
        const cached = cachedSiblings[siblingNodeIndex.toHexString()]
        if (!cached) {
          siblings[level] = this.config.hasher.preHash[level]
        } else if (this.zero instanceof Fp) {
          siblings[level] = Fp.from(cached)
        } else {
          siblings[level] = BigNumber.from(cached)
        }
      }
    }
    return siblings
  }

  private async _getCachedSiblings(
    leafIndex: T,
  ): Promise<{ [index: string]: string }> {
    const cachedSiblings = await this.treeCache.getCachedSiblings(
      this.db,
      this.depth,
      this.metadata.id,
      leafIndex,
    )
    const siblingCache = {}
    for (const sibling of cachedSiblings) {
      siblingCache[sibling.nodeIndex] = BigNumber.from(
        sibling.value,
      ).toHexString()
    }
    if (
      this.metadata.start?.gt(leafIndex) ||
      this.metadata.end?.lte(leafIndex)
    ) {
      throw Error('not in range')
    }
    return siblingCache
  }

  private async _append(
    leaves: Leaf<T>[],
    db: TransactionDB,
  ): Promise<{
    root: T
    index: T
    siblings: T[]
  }> {
    const start = this.latestLeafIndex()
    const latestSiblings = this.siblings()
    const cached: {
      [nodeIndex: string]: string
    } = {}

    let root: T = this.root()

    const trackingLeaves: T[] = await this.indexesOfTrackingLeaves()

    for (let i = 0; i < leaves.length; i += 1) {
      const leaf = leaves[i]
      const index = (leaf.hash instanceof Fp
        ? Fp.from(i).add(start)
        : BigNumber.from(i).add(start)) as T
      if (leaf.shouldTrack) {
        trackingLeaves.push(index)
      }

      // udpate the latest siblings and save the intermediate value if it needs to be tracked
      const leafNodeIndex = BigNumber.from(1)
        .shl(this.depth)
        .or(index)
      let node = leaf.hash
      let hasRightSibling!: boolean
      for (let level = 0; level < this.depth; level += 1) {
        const pathIndex = leafNodeIndex.shr(level)
        hasRightSibling = pathIndex.and(1).isZero()
        if (
          this.config.fullSync ||
          this.shouldTrack(trackingLeaves, pathIndex)
        ) {
          cached[pathIndex.toHexString()] = node.toHexString()
        }

        if (index.gt(0)) {
          // store nodes when if the previous sibling set has a node on the tracking path,
          // because the latest siblings are going to be updated.
          const prevIndexPath = BigNumber.from(1)
            .shl(this.depth)
            .or(index.sub(1))
          const prevPathIndex = prevIndexPath.shr(level)
          const prevSibIndex = BigNumber.from(1).xor(prevPathIndex)
          if (
            prevSibIndex.and(1).isZero() &&
            (this.config.fullSync ||
              this.shouldTrack(trackingLeaves, prevSibIndex))
          ) {
            // if this should track the sibling node which is not a pre-hashed zero
            cached[prevSibIndex.toHexString()] = latestSiblings[
              level
            ].toHexString()
          }
        }

        if (hasRightSibling) {
          // right empty sibling
          latestSiblings[level] = node // current node will be the next merkle proof's left sibling
          node = this.config.hasher.parentOf(
            node,
            this.config.hasher.preHash[level],
          )
        } else {
          // left sibling
          // keep current sibling
          node = this.config.hasher.parentOf(latestSiblings[level], node)
        }
      }
      // update root
      root = node
    }
    const end: T = start.add(leaves.length) as T
    // update the latest siblings
    const backupData = { ...this.data }
    const backupMetadata = { ...this.metadata }
    db.onError(async () => {
      await this.lock.acquire('root', () => {
        // be careful of deep properties that are not copied
        this.data = backupData
        this.metadata = backupMetadata
      })
    })
    this.data = {
      root,
      index: end,
      siblings: latestSiblings,
    }
    this.metadata.end = end
    // Update database
    // update rollup snapshot
    const rollUpSnapshot = {
      root:
        root instanceof Fp ? root.toUint256().toString() : root.toHexString(),
      index: end.toString(),
      siblings: JSON.stringify(
        latestSiblings.map(sib =>
          sib instanceof Fp ? sib.toUint256().toString() : sib.toHexString(),
        ),
      ),
      end: end.toString(),
    }
    db.upsert('LightTree', {
      where: { species: this.species },
      update: rollUpSnapshot,
      create: {
        ...rollUpSnapshot,
        species: this.species,
        start: '0',
      },
      constraintKey: 'species',
    })
    // update cached nodes
    for (const nodeIndex of Object.keys(cached)) {
      this.treeCache.cacheNode(this.metadata.id, nodeIndex, {
        treeId: this.metadata.id,
        nodeIndex,
        value: cached[nodeIndex],
      })
      db.upsert('TreeNode', {
        where: {
          treeId: this.metadata.id,
          nodeIndex,
        },
        update: {
          value: cached[nodeIndex],
        },
        create: {
          treeId: this.metadata.id,
          nodeIndex,
          value: cached[nodeIndex],
        },
      })
    }
    return {
      root,
      index: end,
      siblings: latestSiblings,
    }
  }

  static async initTreeFromDatabase<T extends Fp | BigNumber>({
    db,
    species,
    metadata,
    data,
    config,
  }: {
    db: DB
    species: TreeSpecies
    metadata: TreeMetadata<T>
    data: TreeData<T>
    config: TreeConfig<T>
  }): Promise<{
    db: DB
    species: TreeSpecies
    metadata: TreeMetadata<T>
    data: TreeData<T>
    config: TreeConfig<T>
  }> {
    // Check the data has a valid merkle proof
    if (
      !startingLeafProof(config.hasher, data.root, data.index, data.siblings)
    ) {
      throw Error('bootstrapped with invalid merkle proof')
    }
    // If it does not have force update config, check existing merkle tree
    const existingTree = await db.findOne('LightTree', {
      where: { species },
    })
    if (!config.forceUpdate && data.index.lte(existingTree?.index || 0)) {
      throw Error('Bootstrap is behind the database. Use forceUpdate config')
    }
    // Create or update the merkle tree using the "bootstrapTree" preset query
    const tree = {
      species,
      // rollup sync data
      start: data.index.toString(),
      end: data.index.toString(),
      // rollup snapshot data
      root:
        data.root instanceof Fp
          ? data.root.toString()
          : data.root.toHexString(),
      index: data.index.toString(),
      siblings: JSON.stringify(
        data.siblings.map(sib =>
          sib instanceof Fp ? sib.toString() : sib.toHexString(),
        ),
      ),
    }
    await db.upsert('LightTree', {
      where: { species },
      update: tree,
      create: {
        ...tree,
      },
      constraintKey: 'species',
    })
    const newTree = await db.findOne('LightTree', {
      where: {
        species,
      },
    })
    const { start, end } = newTree
    // Return tree object
    let _start: T
    let _end: T
    if (metadata.start instanceof Fp) {
      _start = Fp.from(start) as T
      _end = Fp.from(end) as T
    } else {
      _start = BigNumber.from(start) as T
      _end = BigNumber.from(end) as T
    }
    return {
      db,
      species,
      metadata: {
        ...metadata,
        start: _start,
        end: _end,
      },
      data,
      config,
    }
  }

  /**
   * It returns true when the given node is a sibling of any leaf to keep tracking
   * @param nodeIndex Tree node's index
   */
  private shouldTrack(trackingLeaves: T[], nodeIndex: BigNumber): boolean {
    let leafIndex: BigNumber
    let pathIndex: BigNumber
    for (const leaf of trackingLeaves) {
      leafIndex = BigNumber.from(1)
        .shl(this.depth)
        .or(leaf)
      pathIndex = leafIndex.shr(
        leafIndex.toBigInt().toString(2).length - // bit length
          nodeIndex.toBigInt().toString(2).length, // bit length
      )
      // if the node is one of the sibling for the leaf proof return true
      if (pathIndex.xor(nodeIndex).eq(1)) return true
    }
    return false
  }

  abstract indexesOfTrackingLeaves(): Promise<T[]>
}
