/* eslint-disable jest/no-disabled-tests */
/* eslint-disable jest/no-hooks */
import { Fp } from '~babyjubjub'
import { UtxoTree, poseidonHasher, Leaf, verifyProof } from '~tree'
import { utxos } from '~dataset/testset-utxos'
import { accounts } from '~dataset/testset-predefined'
import { SQLiteConnector, DB } from '~database'

describe('utxo tree unit test', () => {
  let utxoTree: UtxoTree
  let mockup: DB
  const depth = 48
  beforeAll(async () => {
    // const db = nSQL()
    const { tree, db } = await UtxoTree.sample(depth)
    utxoTree = tree
    mockup = db
  })
  afterAll(async () => {
    await mockup.close()
  })
  describe('dryAppend', () => {
    let prevRoot: Fp
    let result: {
      root: Fp
      index: Fp
      siblings: Fp[]
    }
    beforeAll(async () => {
      prevRoot = utxoTree.root()
      const items: Leaf<Fp>[] = [{ hash: Fp.from(1) }, { hash: Fp.from(2) }]
      result = await utxoTree.dryAppend(...items)
    })
    it('should not update its root', () => {
      expect(utxoTree.root().eq(prevRoot)).toBe(true)
    })
    it('should not return the updated tree data when if the items are added', () => {
      expect(result.root).toBeDefined()
      expect(result.index).toBeDefined()
      expect(result.siblings).toBeDefined()
    })
  })
  describe('append', () => {
    let prevRoot: Fp
    let dryResult: {
      root: Fp
      index: Fp
      siblings: Fp[]
    }
    let result: {
      root: Fp
      index: Fp
      siblings: Fp[]
    }
    beforeAll(async () => {
      prevRoot = utxoTree.root()
      const items: Leaf<Fp>[] = [{ hash: Fp.from(1) }, { hash: Fp.from(2) }]
      dryResult = await utxoTree.dryAppend(...items)
      result = await utxoTree.append(...items)
    }, 30000)
    it('should update its root and its value should equal to the dry run', () => {
      expect(result.root.eq(prevRoot)).toBe(false)
      expect(result.root.eq(dryResult.root)).toBe(true)
      expect(result.index.eq(dryResult.index)).toBe(true)
      result.siblings.forEach((sib, i) => {
        expect(sib.eq(dryResult.siblings[i])).toBe(true)
      }, 30000)
    })
    it.todo('should have same result with its solidity version')
  })
  describe('tracking', () => {
    const items: Leaf<Fp>[] = [
      utxos.utxo1_out_1,
      utxos.utxo1_out_2,
      utxos.utxo2_1_out_1,
      utxos.utxo2_1_out_2,
    ].map(note => ({
      hash: note.hash(),
      note,
    }))
    beforeAll(async () => {
      await utxoTree.append(...items)
      utxoTree.updatePubKeys([accounts.alice.zkAddress])
    })
    it("should track Alice's utxos while not tracking Bob's", async () => {
      const aliceUtxoProof = await utxoTree.merkleProof({
        hash: utxos.utxo1_out_2.hash(),
      })
      expect(verifyProof(poseidonHasher(depth), aliceUtxoProof)).toBe(true)
      await expect(
        utxoTree.merkleProof({
          hash: utxos.utxo2_2_out_2.hash(),
        }),
      ).rejects.toThrow('')
    }, 30000)
    it('should generate merkle proof using index together', async () => {
      const index = utxoTree.latestLeafIndex().sub(3)
      const proof = await utxoTree.merkleProof({
        hash: utxos.utxo1_out_2.hash(),
        index,
      })
      expect(verifyProof(poseidonHasher(depth), proof)).toBe(true)
    })
    it('should fail to generate a merkle proof with an invalid index', async () => {
      const index = utxoTree.latestLeafIndex().sub(4)
      await expect(
        utxoTree.merkleProof({
          hash: utxos.utxo1_out_2.hash(),
          index,
        }),
      ).rejects.toThrow('Created invalid merkle proof')
    })
  })
})
