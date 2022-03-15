/* eslint-disable jest/no-disabled-tests */
/* eslint-disable jest/no-hooks */
import SparseTree from 'simple-smt'
import { Fp } from '@zkopru/babyjubjub'
import * as uuid from 'uuid'
import assert from 'assert'
import { LightRollUpTree } from '../../src/light-rollup-tree'
import { genesisRoot, poseidonHasher } from '../../src/hasher'
import sample from '~tree/sample'
import { DB } from '~database'
import { TreeCache } from '../../src/utils'

class TestTree extends LightRollUpTree<Fp> {
  // eslint-disable-next-line class-methods-use-this
  async indexesOfTrackingLeaves() {
    return []
  }
}

describe('rollup tree unit test', () => {
  let testTree: TestTree
  let mockup: DB
  const depth = 20
  beforeEach(async () => {
    const { db } = await sample(depth)
    mockup = db
    const preHashes = poseidonHasher(depth).preHash
    testTree = new TestTree({
      db: mockup,
      species: 10,
      metadata: {
        id: uuid.v4(),
        species: 10,
        start: Fp.from(0),
        end: Fp.from(0),
      },
      data: {
        root: genesisRoot(poseidonHasher(depth)),
        index: Fp.zero,
        siblings: preHashes.slice(0, -1),
      },
      config: {
        hasher: poseidonHasher(depth),
        forceUpdate: true,
        fullSync: true,
      },
      treeCache: new TreeCache(),
    })
  })
  afterEach(async () => {
    await mockup.close()
  })

  describe('append()', () => {
    it('should match external for single append', async () => {
      console.log('helo')
      const { parentOf, preHash } = poseidonHasher(depth)
      const tree = new SparseTree<Fp>({
        depth: depth + 1,
        hashFn: (item1, item2) => {
          const hash = parentOf(item1, item2)
          return hash
        },
        preHashFn: (_, level) => {
          return preHash[depth - level]
        },
        rightToLeft: true,
      })
      assert.equal(
        tree.root().toString(),
        testTree.root().toString(),
        'Starting roots do not match',
      )
      for (let x = 1; x < 100; x += 1) {
        // eslint-disable-next-line no-loop-func
        await mockup.transaction(db => {
          testTree.append(
            [
              {
                hash: Fp.from(x),
              },
            ],
            db,
          )
        })
        tree.append(Fp.from(x))
        assert.equal(
          tree.root().toString(),
          testTree.root().toString(),
          `Roots do not match for index ${x}`,
        )
      }
    })

    it('should match external for batch append', async () => {
      const { parentOf, preHash } = poseidonHasher(depth)
      const tree = new SparseTree<Fp>({
        depth: depth + 1,
        hashFn: (item1, item2) => {
          const hash = parentOf(item1, item2)
          return hash
        },
        preHashFn: (_, level) => {
          return preHash[depth - level]
        },
        rightToLeft: true,
      })
      assert.equal(
        tree.root().toString(),
        testTree.root().toString(),
        'Starting roots do not match',
      )
      const leaves = Array(100)
        .fill(null)
        .map((_, index) => ({
          hash: Fp.from(index + 1),
        }))
      await mockup.transaction(db => {
        testTree.append(leaves, db)
      })
      tree.appendMany(leaves.map(l => l.hash))
      assert.equal(
        tree.root().toString(),
        testTree.root().toString(),
        `Roots do not match`,
      )
    })

    it('should match external for single dry append', async () => {
      const { parentOf, preHash } = poseidonHasher(depth)
      const tree = new SparseTree<Fp>({
        depth: depth + 1,
        hashFn: (item1, item2) => {
          const hash = parentOf(item1, item2)
          return hash
        },
        preHashFn: (_, level) => {
          return preHash[depth - level]
        },
        rightToLeft: true,
      })
      assert.equal(
        tree.root().toString(),
        testTree.root().toString(),
        'Starting roots do not match',
      )
      const leaves = Array(1)
        .fill(null)
        .map((_, index) => ({
          hash: Fp.from(index + 1),
        }))
      const { root } = await testTree.dryAppend(leaves)
      tree.appendMany(leaves.map(l => l.hash))
      assert.equal(
        root.toString(),
        tree.root().toString(),
        `Roots do not match`,
      )
    })

    it('should match external for batch dry append', async () => {
      const { parentOf, preHash } = poseidonHasher(depth)
      const tree = new SparseTree<Fp>({
        depth: depth + 1,
        hashFn: (item1, item2) => {
          const hash = parentOf(item1, item2)
          return hash
        },
        preHashFn: (_, level) => {
          return preHash[depth - level]
        },
        rightToLeft: true,
      })
      assert.equal(
        tree.root().toString(),
        testTree.root().toString(),
        'Starting roots do not match',
      )
      const leaves = Array(100)
        .fill(null)
        .map((_, index) => ({
          hash: Fp.from(index + 1),
        }))
      const { root } = await testTree.dryAppend(leaves)
      tree.appendMany(leaves.map(l => l.hash))
      assert.equal(
        root.toString(),
        tree.root().toString(),
        `Roots do not match`,
      )
    })
  })
})
