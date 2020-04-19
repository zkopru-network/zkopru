/* eslint-disable jest/no-hooks */
import { Field } from '@zkopru/babyjubjub'
import { nSQL } from '@nano-sql/core'
import { uuid } from '@nano-sql/core/lib/utilities'
import { schema } from '@zkopru/database'
import { UtxoTree, TreeConfig, poseidonHasher, Item } from '~tree'

describe('utxo Tree Unit Test', () => {
  let utxoTree: UtxoTree
  const utxoTreeMetadata = {
    id: uuid(),
    index: 1,
    zkopruId: 'tempzkopru',
    start: Field.from(0),
    end: Field.from(0),
  }
  const depth = 31
  const utxoTreeConfig: TreeConfig = {
    hasher: poseidonHasher(depth),
    forceUpdate: true,
    fullSync: true,
  }
  const preHashes = poseidonHasher(depth).preHash
  const utxoTreeInitialData = {
    root: preHashes[preHashes.length - 1],
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
        schema.withdrawal,
        schema.withdrawalTree,
        schema.withdrawalTreeNode('unittest'),
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
    it('should return the last item of the prehashed zero for its initial root', () => {
      expect(utxoTree.root().eq(preHashes[preHashes.length - 1])).toStrictEqual(
        true,
      )
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
      const items: Item[] = [
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
    let realResult: {
      root: Field
      index: Field
      siblings: Field[]
    }
    beforeAll(async () => {
      prevRoot = utxoTree.root()
      const items: Item[] = [
        { leafHash: Field.from(1) },
        { leafHash: Field.from(2) },
      ]
      dryResult = await utxoTree.dryAppend(...items)
      realResult = await utxoTree.append(...items)
    })
    it('should update its root and its value should equal to the dry run', () => {
      expect(realResult.root.eq(prevRoot)).toBe(false)
      expect(realResult.root.eq(dryResult.root)).toBe(true)
      expect(realResult.index.eq(dryResult.index)).toBe(true)
      realResult.siblings.forEach((sib, i) => {
        expect(sib.eq(dryResult.siblings[i])).toBe(true)
      })
    })
    it.todo('should have same result with its solidity version')
  })
})
