/* eslint-disable jest/no-hooks */
import { Field } from '@zkopru/babyjubjub'
import { nSQL } from '@nano-sql/core'
import { uuid } from '@nano-sql/core/lib/utilities'
import { schema } from '@zkopru/database'
import { WithdrawalTree, TreeConfig, poseidonHasher, Item } from '~tree'
import { utxos, address } from '../testset'
// import { Withdrawal, Note } from '@zkopru/transaction'

describe('withdrawal Tree Unit Test', () => {
  let withdrawalTree: WithdrawalTree
  const withdrawalTreeMetadata = {
    id: uuid(),
    index: 1,
    zkopruId: 'tempzkopru',
    start: Field.from(0),
    end: Field.from(0),
  }
  const depth = 31
  const withdrawalTreeConfig: TreeConfig = {
    hasher: poseidonHasher(depth),
    forceUpdate: true,
    fullSync: true,
  }
  const preHashes = poseidonHasher(depth).preHash
  const withdrawalTreeInitialData = {
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
        schema.withdrawal,
        schema.withdrawalTree,
        schema.withdrawalTreeNode(withdrawalTreeMetadata.id),
        schema.withdrawal,
        schema.withdrawalTree,
        schema.withdrawalTreeNode('unittest'),
      ],
      version: 3,
    })
    const db = nSQL()
    db.useDatabase(dbName)
    withdrawalTree = new WithdrawalTree({
      db,
      metadata: withdrawalTreeMetadata,
      itemSchema: schema.withdrawal,
      treeSchema: schema.withdrawalTree,
      treeNodeSchema: schema.withdrawalTreeNode(withdrawalTreeMetadata.id),
      data: withdrawalTreeInitialData,
      config: withdrawalTreeConfig,
    })
  })
  describe('root()', () => {
    it('should return the last item of the prehashed zero for its initial root', () => {
      expect(
        withdrawalTree.root().eq(preHashes[preHashes.length - 1]),
      ).toStrictEqual(true)
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
      prevRoot = withdrawalTree.root()
      const items: Item[] = [
        { leafHash: Field.from(1) },
        { leafHash: Field.from(2) },
      ]
      result = await withdrawalTree.dryAppend(...items)
    })
    it('should not update its root', () => {
      expect(withdrawalTree.root().eq(prevRoot)).toBe(true)
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
      prevRoot = withdrawalTree.root()
      const items: Item[] = [
        { leafHash: Field.from(1) },
        { leafHash: Field.from(2) },
      ]
      dryResult = await withdrawalTree.dryAppend(...items)
      realResult = await withdrawalTree.append(...items)
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
  describe('tracking', () => {
    const addresses = [address.USER_A]
    const items: Item[] = [
      utxos.utxo1_in_1.toWithdrawal({ to: address.USER_A, fee: 1 }),
      utxos.utxo1_out_1,
      utxos.utxo2_1_in_1,
    ].map(note => ({
      leafHash: note.hash(),
      note,
    }))
    beforeAll(() => {
      withdrawalTree.updateAddresses(addresses)
      withdrawalTree.append(...items)
    })
    it("should track Alice's utxos while not tracking Bob's", async () => {
      withdrawalTree.merkleProof({ hash: items[0].leafHash })
    })
  })
})
