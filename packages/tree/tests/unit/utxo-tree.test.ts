/* eslint-disable jest/no-disabled-tests */
/* eslint-disable jest/no-hooks */
import { v4 } from 'uuid'
import { Field } from '~babyjubjub'
import {
  UtxoTree,
  TreeConfig,
  poseidonHasher,
  Leaf,
  genesisRoot,
  verifyProof,
} from '~tree'
import { utxos } from '~dataset/testset-utxos'
import { accounts } from '~dataset/testset-keys'
import { DB, TreeSpecies, MockupDB } from '~prisma'

describe('utxo tree unit test', () => {
  let utxoTree: UtxoTree
  const utxoTreeMetadata = {
    id: v4(),
    index: 1,
    species: TreeSpecies.UTXO,
    start: Field.from(0),
    end: Field.from(0),
  }
  const depth = 31
  const utxoTreeConfig: TreeConfig<Field> = {
    hasher: poseidonHasher(depth),
    forceUpdate: true,
    fullSync: true,
  }
  const preHashes = poseidonHasher(depth).preHash
  const utxoTreeInitialData = {
    root: genesisRoot(poseidonHasher(depth)),
    index: Field.zero,
    siblings: preHashes,
  }
  let mockup: MockupDB
  beforeAll(async () => {
    // const db = nSQL()
    mockup = await DB.mockup()
    utxoTree = new UtxoTree({
      db: mockup.db,
      metadata: utxoTreeMetadata,
      data: utxoTreeInitialData,
      config: utxoTreeConfig,
    })
    await utxoTree.init()
  })
  afterAll(async () => {
    await mockup.terminate()
  })
  describe('root()', () => {
    it('should return the genesis root value for its initial root', () => {
      expect(utxoTree.root().eq(utxoTreeInitialData.root)).toStrictEqual(true)
    })
  })
  describe('dryAppend', () => {
    let prevRoot: Field
    let result: {
      root: Field
      index: Field
      siblings: Field[]
    }
    beforeAll(async () => {
      prevRoot = utxoTree.root()
      const items: Leaf<Field>[] = [
        { hash: Field.from(1) },
        { hash: Field.from(2) },
      ]
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
    let prevRoot: Field
    let dryResult: {
      root: Field
      index: Field
      siblings: Field[]
    }
    let result: {
      root: Field
      index: Field
      siblings: Field[]
    }
    beforeAll(async () => {
      prevRoot = utxoTree.root()
      const items: Leaf<Field>[] = [
        { hash: Field.from(1) },
        { hash: Field.from(2) },
      ]
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
    const items: Leaf<Field>[] = [
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
      const proof = await utxoTree.merkleProof({
        hash: utxos.utxo1_out_2.hash(),
        index,
      })
      expect(verifyProof(poseidonHasher(depth), proof)).toBe(false)
    })
  })
})
