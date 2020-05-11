/* eslint-disable jest/no-disabled-tests */
/* eslint-disable jest/no-hooks */
import { nSQL } from '@nano-sql/core'
import { uuid } from '@nano-sql/core/lib/utilities'
import { Field } from '~babyjubjub'
import { schema } from '~database'
import {
  UtxoTree,
  TreeConfig,
  poseidonHasher,
  Item,
  genesisRoot,
  verifyProof,
} from '~tree'
import { utxos } from '~dataset/testset-utxos'
import { keys } from '~dataset/testset-keys'

describe('utxo tree unit test', () => {
  let utxoTree: UtxoTree
  const utxoTreeMetadata = {
    id: uuid(),
    index: 1,
    zkopruId: 'tempzkopru',
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
  beforeAll(async () => {
    // const db = nSQL()
    const dbName = 'unittest'
    await nSQL().createDatabase({
      id: dbName,
      mode: 'TEMP',
      tables: [
        schema.utxo,
        schema.utxoTree,
        schema.utxoTreeNode(utxoTreeMetadata.id),
      ],
      version: 3,
    })
    const db = nSQL()
    db.useDatabase(dbName)
    utxoTree = new UtxoTree({
      db,
      metadata: utxoTreeMetadata,
      itemSchema: schema.utxo,
      treeSchema: schema.utxoTree,
      treeNodeSchema: schema.utxoTreeNode(utxoTreeMetadata.id),
      data: utxoTreeInitialData,
      config: utxoTreeConfig,
    })
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
      const items: Item<Field>[] = [
        { leafHash: Field.from(1) },
        { leafHash: Field.from(2) },
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
      const items: Item<Field>[] = [
        { leafHash: Field.from(1) },
        { leafHash: Field.from(2) },
      ]
      dryResult = await utxoTree.dryAppend(...items)
      result = await utxoTree.append(...items)
    })
    it('should update its root and its value should equal to the dry run', () => {
      expect(result.root.eq(prevRoot)).toBe(false)
      expect(result.root.eq(dryResult.root)).toBe(true)
      expect(result.index.eq(dryResult.index)).toBe(true)
      result.siblings.forEach((sib, i) => {
        expect(sib.eq(dryResult.siblings[i])).toBe(true)
      })
    })
    it.todo('should have same result with its solidity version')
  })
  describe('tracking', () => {
    const items: Item<Field>[] = [
      utxos.utxo1_out_1,
      utxos.utxo1_out_2,
      utxos.utxo2_1_out_1,
      utxos.utxo2_1_out_2,
    ].map(note => ({
      leafHash: note.hash(),
      note,
    }))
    beforeAll(async () => {
      await utxoTree.append(...items)
      utxoTree.updatePubKeys([keys.alicePubKey])
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
    })
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
