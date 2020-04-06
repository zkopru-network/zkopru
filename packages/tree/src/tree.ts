import { nanoSQL } from '@nano-sql/core'
import { Field, Point } from '@zkopru/babyjubjub'
import { Output, OutputStatus } from '@zkopru/transaction'
import {
  schema,
  OutputSqlObject,
  MerkleProofCacheSqlObject,
} from '@zkopru/database'
import bigInt, { BigInteger } from 'big-integer'
import { Hasher } from './hasher'

export interface MerkleProof {
  root: Field
  index: Field
  leaf: Field
  siblings: Field[]
}

export interface Item {
  leafHash: Field
  utxo?: Output
}

export function merkleProof(hasher: Hasher, proof: MerkleProof): boolean {
  let path = proof.index.val
  let node = proof.leaf
  for (let i = 0; i < proof.siblings.length; i += 1) {
    if (path.and(1).isZero()) {
      // right sibling
      node = hasher.parentOf(node, proof.siblings[i])
    } else {
      // left sibling
      node = hasher.parentOf(proof.siblings[i], node)
    }
    path = path.shiftRight(1)
  }
  return node.equal(proof.root)
}

export function startingLeafProof(
  hasher: Hasher,
  root: Field,
  index: Field,
  siblings: Field[],
): boolean {
  const depth = siblings.length
  // calculate the siblings validity
  let path: BigInteger = index.val
  for (let i = 0; i < depth; i += 1) {
    if (path.and(1).isZero()) {
      // Right sibling should be a prehashed zero
      if (!siblings[i].equal(hasher.preHash[i])) return false
    } else {
      // Left sibling should not be a prehashed zero
      // eslint-disable-next-line no-lonely-if
      if (siblings[i].equal(hasher.preHash[i])) return false
    }
    path = path.shiftRight(1)
  }
  return merkleProof(hasher, { root, index, leaf: hasher.preHash[0], siblings })
}

export enum TreeType {
  UTXO = 1,
  WITHDRAWAL = 2,
  NULLIFIER = 3,
}

export interface TreeMetadata {
  id: string
  type: TreeType
  index: number
  zkopruId: string
  start: Field
  end: Field
}

export interface TreeData {
  root: Field
  index: Field
  siblings: Field[]
}

export interface TreeConfig {
  hasher: Hasher
  pubKeysToObserve: Point[]
  addressesToObserve: string[]
  forceUpdate?: boolean
  fullSync?: boolean
}

export class LightRollUpTree {
  db: nanoSQL

  config: TreeConfig

  metadata: TreeMetadata

  data: TreeData

  constructor({
    db,
    metadata,
    data,
    config,
  }: {
    db: nanoSQL
    metadata: TreeMetadata
    data: TreeData
    config: TreeConfig
  }) {
    this.db = db
    this.metadata = metadata
    this.data = data
    this.config = config
    if (!metadata.id) throw Error('UUID is not defined')
  }

  static async bootstrap({
    db,
    metadata,
    data,
    config,
  }: {
    db: nanoSQL
    metadata: TreeMetadata
    data: TreeData
    config: TreeConfig
  }): Promise<LightRollUpTree> {
    // Check the data has a valid merkle proof
    if (
      !startingLeafProof(config.hasher, data.root, data.index, data.siblings)
    ) {
      throw Error('bootstrapped with invalid merkle proof')
    }
    // If it does not have force update config, check existing merkle tree
    const existingTreeQuery = await db
      .selectTable(schema.tree.name)
      .presetQuery('getTree', { type: metadata.type, index: metadata.index })
      .exec()
    if (!config.forceUpdate) {
      if (
        existingTreeQuery.length > 0 &&
        data.index.lte(existingTreeQuery[0].data.index)
      ) {
        throw Error('Bootstrap is behind the database. Use forceUpdate config')
      }
    }

    // Create or update the merkle tree using the "bootstrapTree" preset query
    const queryResult = await db
      .selectTable(schema.tree.name)
      .presetQuery('bootstrapTree', {
        id: existingTreeQuery.length > 0 ? existingTreeQuery[0].id : undefined,
        index: metadata.index,
        type: metadata.type,
        zkopru: metadata.zkopruId,
        data: {
          root: data.root.toHex(),
          index: data.index.toHex(),
          siblings: data.siblings.map(f => f.toHex()),
        },
      })
      .exec()
    const { id, start, end } = queryResult[0]
    // Return tree object
    return new LightRollUpTree({
      db,
      metadata: {
        ...metadata,
        id,
        start: Field.from(start),
        end: Field.from(end),
      },
      data,
      config,
    })
  }

  updatePubKeys(pubKeys: Point[]) {
    this.config.pubKeysToObserve = pubKeys
  }

  updateAddresses(addresses: string[]) {
    this.config.addressesToObserve = addresses
  }

  root(): Field {
    return Field.from(this.data.root)
  }

  depth(): number {
    return this.data.siblings.length
  }

  maxSize(): Field {
    return Field.from(bigInt.one.shiftLeft(this.depth()))
  }

  async indexesOfTrackingLeaves(): Promise<Field[]> {
    let presetFnName
    let keys: string[]
    switch (this.metadata.type) {
      case TreeType.UTXO:
        presetFnName = 'utxosToTrack'
        keys = this.config.pubKeysToObserve.map(point => point.toHex())
        break
      case TreeType.WITHDRAWAL:
        presetFnName = 'withdrawalsToTrack'
        keys = this.config.addressesToObserve
        break
      default:
        return []
    }
    const trackingLeaves = await this.db
      .selectTable(schema.output.name)
      .presetQuery(presetFnName, {
        tree: this.metadata.id,
        keys,
      })
      .exec()
    return trackingLeaves.map(row => Field.from(row.index))
  }

  latestLeafIndex(): Field {
    return this.data.index
  }

  siblings(): Field[] {
    return [...this.data.siblings]
  }

  async merkleProof({
    hash,
    index,
  }: {
    hash: string
    index: string
  }): Promise<MerkleProof> {
    const depth = this.depth()
    const cachedSiblings = await this.db
      .selectTable(schema.merkleProofCache(this.metadata.id || '').name)
      .presetQuery('getSiblings', {
        depth,
        index,
      })
      .exec()

    const siblingCache = {}
    for (const sibling of cachedSiblings) {
      siblingCache[sibling.nodeIndex] = Field.from(sibling.value)
    }

    if (this.metadata.start?.gt(index) || this.metadata.end?.lte(index)) {
      throw Error('not in range')
    }

    const siblings = Array(depth).fill(undefined)
    const leafNodeIndex = Field.from(index).val.or(bigInt.one.shiftRight(depth))
    let pathNodeIndex!: BigInteger
    let siblingNodeIndex!: BigInteger
    for (let level = 0; level < depth; level += 1) {
      pathNodeIndex = leafNodeIndex.shiftRight(level)
      siblingNodeIndex = pathNodeIndex.xor(1)

      if (siblingNodeIndex.gt(this.metadata.end.val.shiftRight(level))) {
        // should return pre hashed zero
        siblings[level] = this.config.hasher.preHash[level]
      } else {
        // should find the node value
        siblings[level] = siblingCache[Field.from(siblingNodeIndex).toHex()]
        if (siblings[level] === undefined)
          throw Error(
            'Sibling was not cached. Make sure you added your public key before scanning',
          )
      }
    }
    const root = this.root()
    return { root, index: Field.from(index), leaf: Field.from(hash), siblings }
  }

  async append(...items: Item[]) {
    const start = this.latestLeafIndex()
    const depth = this.depth()
    const latestSiblings = this.siblings()
    const merkleProofCacheQuery: MerkleProofCacheSqlObject[] = []
    const outputAppendingQuery: OutputSqlObject[] = []
    let root!: Field

    const trackingLeaves: Field[] = await this.indexesOfTrackingLeaves()

    let index = start
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]
      index = start.add(i)
      // if utxo exists, save the data and mark as an item to keep tracking
      if (this.config.fullSync || items[i].utxo) {
        outputAppendingQuery.push({
          hash: item.leafHash.toHex(),
          tree: this.metadata.id,
          index: index.toHex(),
          eth: item.utxo?.eth.toHex(),
          pubKey: item.utxo?.pubKey.toHex(),
          salt: item.utxo?.salt.toHex(),
          tokenAddr: item.utxo?.tokenAddr.toHex(),
          erc20Amount: item.utxo?.erc20Amount.toHex(),
          nft: item.utxo?.nft.toHex(),
          status: item.utxo?.status || OutputStatus.NON_INCLUDED,
        })
      }

      if (items[i].utxo) {
        trackingLeaves.push(index)
      }

      // udpate the latest siblings and save the intermediate value if it needs to be tracked
      const leafIndex = index.val.or(bigInt.one.shiftRight(depth))
      let node = item.leafHash
      let hasRightSibling!: boolean
      for (let level = 0; level < depth; level += 1) {
        const pathIndex = leafIndex.shiftRight(level)
        hasRightSibling = pathIndex.and(1).isZero()
        if (
          this.config.fullSync ||
          this.shouldTrack(trackingLeaves, pathIndex)
        ) {
          merkleProofCacheQuery.push({
            nodeIndex: Field.from(pathIndex).toHex(),
            value: node.toHex(),
          })
        }
        if (
          this.config.fullSync ||
          (this.shouldTrack(trackingLeaves, pathIndex.xor(1)) &&
            !hasRightSibling)
        ) {
          // if this should track the sibling node which is not a pre-hashed zero
          merkleProofCacheQuery.push({
            nodeIndex: Field.from(pathIndex.xor(1)).toHex(),
            value: latestSiblings[level].toHex(),
          })
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
    // update the latest siblings
    this.data = {
      root,
      index,
      siblings: latestSiblings,
    }
    // Update database
    await this.db
      .selectTable(schema.tree.name)
      .presetQuery('updateTree', {
        id: this.metadata.id,
        data: {
          root: root.toHex(),
          index: index.toHex(),
          siblings: latestSiblings.map(sib => sib.toHex()),
        },
      })
      .exec()

    await this.db
      .selectTable(schema.output.name)
      .query('upsert', outputAppendingQuery)
      .exec()
    await this.db
      .selectTable(schema.merkleProofCache(this.metadata.id || '').name)
      .query('upsert', merkleProofCacheQuery)
      .exec()
  }

  /**
   * It returns true when the given node is a sibling of any leaf to keep tracking
   * @param nodeIndex Tree node's index
   */
  private shouldTrack(trackingLeaves: Field[], nodeIndex: BigInteger): boolean {
    const depth = this.depth()
    let leafIndex: bigInt.BigInteger
    let pathIndex: bigInt.BigInteger
    for (const leaf of trackingLeaves) {
      leafIndex = leaf.val.or(bigInt.one.shiftLeft(depth))
      pathIndex = leafIndex.shiftRight(
        leafIndex.bitLength().subtract(nodeIndex.bitLength()),
      )
      // if the node is one of the sibling for the leaf proof return true
      if (pathIndex.xor(nodeIndex).eq(1)) return true
    }
    return false
  }
}
