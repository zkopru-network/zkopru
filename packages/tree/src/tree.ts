/* eslint-disable max-classes-per-file */
/* eslint-disable radix */
/* eslint-disable @typescript-eslint/camelcase */
// import * as semaphore from 'semaphore-merkle-tree'
import { Field, UTXO } from '@zkopru/commons'
import bigInt, { BigInteger } from 'big-integer'
import AsyncLock from 'async-lock'
import { CachedStore, Store } from './store'
import { Hasher } from './hasher'

export interface MerkleProof {
  root: Field
  index: Field
  leaf: Field
  siblings: Field[]
}

export interface Bootstrap {
  root: Field
  index: Field
  siblings: Field[]
}

export interface Item {
  leafHash: Field
  utxo?: UTXO
}

export function merkleProof(
  hasher: Hasher,
  root: Field,
  index: Field,
  value: Field,
  siblings: Field[],
): boolean {
  let path = index.val
  let node = value
  for (let i = 0; i < siblings.length; i += 1) {
    if (path.and(1).isZero()) {
      // right sibling
      node = hasher.parentOf(node, siblings[i])
    } else {
      // left sibling
      node = hasher.parentOf(siblings[i], node)
    }
    path = path.shiftRight(1)
  }
  return node.equal(root)
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
  return merkleProof(hasher, root, index, hasher.preHash[0], siblings)
}

export class LightRollUpTree {
  fullSync: boolean

  prefix: string

  lock: AsyncLock

  hasher: Hasher

  cachedStore: CachedStore
  // cache: {[key: string]: Buffer}
  // listCache: {[key: string]: Buffer[]}
  // store: Store

  private prefixed = (key: string) => Buffer.from(`${this.prefix}:${key}`)

  private keys = {
    depth: this.prefixed('d'),
    root: this.prefixed('r'),
    leafIndex: (index: Field) =>
      Buffer.concat([this.prefixed('l'), index.toBuffer()]),
    sibling: (level: number) =>
      Buffer.concat([this.prefixed('s'), Buffer.from([level])]),
    node: (nodeIndex: Field) =>
      Buffer.concat([this.prefixed('n'), nodeIndex.toBuffer()]),
    start: this.prefixed('si'),
    end: this.prefixed('ei'),
    tracking: this.prefixed('t'),
  }

  constructor({
    prefix,
    store,
    hasher,
    lightSync,
  }: {
    prefix: string
    store: Store
    hasher: Hasher
    lightSync: boolean
  }) {
    this.fullSync = lightSync
    this.prefix = prefix
    this.hasher = hasher
    this.cachedStore = new CachedStore(store)
    this.lock = new AsyncLock()
  }

  async bootstrap(data: Bootstrap) {
    this.lock.acquire(this.prefix, async () => {
      const batchJob: Array<{ key: Buffer; value: Buffer }> = []
      // 1. prove the merkle proof with latest option
      if (
        !startingLeafProof(this.hasher, data.root, data.index, data.siblings)
      ) {
        throw Error('bootstrapped with invalid merkle proof')
      }
      // 2. store the root / index / latest siblings
      this.cachedStore.put(
        {
          key: this.keys.depth,
          value: Buffer.from([data.siblings.length]),
        },
        batchJob,
      )
      // store latest siblings
      for (let i = 0; i < data.siblings.length; i += 1) {
        this.cachedStore.put(
          {
            key: this.keys.sibling(i),
            value: data.siblings[i].toBuffer(),
          },
          batchJob,
        )
      }

      // store root
      this.cachedStore.put(
        {
          key: this.keys.root,
          value: data.root.toBuffer(),
        },
        batchJob,
      )

      // store range
      this.cachedStore.put(
        {
          key: this.keys.start,
          value: data.index.toBuffer(),
        },
        batchJob,
      )
      this.cachedStore.put(
        {
          key: this.keys.end,
          value: data.index.toBuffer(),
        },
        batchJob,
      )
      await this.cachedStore.batchPut(batchJob)
    })
  }

  async root(): Promise<Field> {
    return Field.fromBuffer(await this.cachedStore.get(this.keys.root)) // max is 255
  }

  async depth(): Promise<number> {
    return (await this.cachedStore.get(this.keys.depth))[0] // max is 255
  }

  async maxSize(): Promise<Field> {
    const depth = await this.depth()
    return Field.from(bigInt.one.shiftLeft(depth))
  }

  async indexesOfTrackingLeaves(): Promise<Field[]> {
    const list = (await this.cachedStore.getList(this.keys.tracking)).map(
      Field.fromBuffer,
    )
    return list
  }

  async index(): Promise<Field> {
    const range = await this.range()
    return range.end
  }

  async range(): Promise<{ start: Field; end: Field }> {
    const start = Field.fromBuffer(await this.cachedStore.get(this.keys.start))
    const end = Field.fromBuffer(await this.cachedStore.get(this.keys.end))
    return {
      start,
      end,
    }
  }

  async siblings(): Promise<Field[]> {
    const depth = await this.depth()
    const siblings: Field[] = Array<Field>(depth)
    for (let level = 0; level < depth; level += 1) {
      siblings[level] = Field.fromBuffer(
        await this.cachedStore.get(this.keys.sibling(level)),
      )
    }
    return siblings
  }

  async merkleProof(leaf: Field): Promise<MerkleProof> {
    return new Promise<MerkleProof>(resolve => {
      this.lock.acquire(this.prefix, async () => {
        let index
        try {
          index = Field.fromBuffer(
            await this.cachedStore.get(this.keys.leafIndex(leaf), {
              skipCache: true,
            }),
          )
        } catch (err) {
          throw Error('Failed to find the index of the leaf')
        }

        const { start, end } = await this.range()
        if (start.gt(index) || end.lte(index)) {
          throw Error('not in range')
        }

        const depth = await this.depth()
        const siblings: Field[] = Array<Field>(depth)

        const path = index.val
        let siblingIndex!: BigInteger
        for (let level = 0; level < depth; level += 1) {
          siblingIndex = path.shiftRight(level).xor(1)
          if (siblingIndex.gt(end.val.shiftRight(level))) {
            // should return pre hashed zero
            siblings[level] = this.hasher.preHash[level]
          } else {
            // should find the node value
            try {
              siblings[level] = Field.fromBuffer(
                await this.cachedStore.get(
                  this.keys.node(Field.from(siblingIndex)),
                  { skipCache: true },
                ),
              )
            } catch (err) {
              throw Error('Failed to find the sibling data')
            }
          }
        }
        const root = await this.root()
        resolve({ root, index, leaf, siblings })
      })
    })
  }

  async append(...items: Item[]) {
    this.lock.acquire(this.prefix, async () => {
      const start = await this.index()
      const batchJob: Array<{ key: Buffer; value: Buffer }> = []
      const batchJobForList: Array<{ key: Buffer; value: Buffer }> = []

      const depth = await this.depth()
      const latestSiblings = await this.siblings()
      let root!: Field
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i]
        const index = start.add(i)
        // if utxo exists, save the data and mark as an item to keep tracking
        if (this.fullSync || items[i].utxo) {
          this.cachedStore.put(
            {
              key: this.keys.leafIndex(item.leafHash),
              value: index.toBuffer(),
            },
            batchJob,
            { skipCache: this.fullSync },
          )
        }
        if (items[i].utxo) {
          this.cachedStore.pushToList(
            {
              key: this.keys.tracking,
              value: index.toBuffer(),
            },
            batchJobForList,
          )
        }
        // udpate the latest siblings and save the intermediate value if it needs to be tracked
        let path = index.val
        let node = item.leafHash
        let hasRightSibling!: boolean
        for (let level = 0; level < depth; level += 1) {
          hasRightSibling = path.and(1).isZero()
          if (this.fullSync || (await this.shouldTrack(path))) {
            // if this should track the current node
            this.cachedStore.put(
              {
                key: this.keys.node(Field.from(path)),
                value: node.toBuffer(),
              },
              batchJob,
              { skipCache: true },
            )
          }
          if (
            this.fullSync ||
            ((await this.shouldTrack(path.xor(1))) && !hasRightSibling)
          ) {
            // if this should track the sibling node which is not a pre-hashed zero
            this.cachedStore.put(
              {
                key: this.keys.node(Field.from(path.xor(1))),
                value: latestSiblings[level].toBuffer(),
              },
              batchJob,
              { skipCache: true },
            )
          }
          if (hasRightSibling) {
            // right empty sibling
            latestSiblings[level] = node // current node will be the next merkle proof's left sibling
            node = this.hasher.parentOf(node, this.hasher.preHash[level])
          } else {
            // left sibling
            // keep current sibling
            node = this.hasher.parentOf(latestSiblings[level], node)
          }
          path = path.shiftRight(1)
        }
        // update root
        root = node
      }
      // update the latest siblings
      for (let level = 0; level < depth; level += 1) {
        this.cachedStore.put(
          {
            key: this.keys.sibling(level),
            value: latestSiblings[level].toBuffer(),
          },
          batchJob,
        )
      }
      // update the index
      await this.cachedStore.put(
        {
          key: this.keys.end,
          value: start.add(items.length).toBuffer(),
        },
        batchJob,
      )
      this.cachedStore.batchPut(batchJob)
      // update the root
      await this.cachedStore.put(
        {
          key: this.keys.root,
          value: root.toBuffer(),
        },
        batchJob,
      )
      this.cachedStore.batchPut(batchJob)
    })
  }

  /**
   * It returns true when the given node is a sibling of any leaf to keep tracking
   * @param nodeIndex Tree node's index
   */
  private async shouldTrack(nodeIndex: BigInteger): Promise<boolean> {
    const depth = await this.depth()
    const trackingLeaves = await this.indexesOfTrackingLeaves()
    let leafIndex
    let pathIndex
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
