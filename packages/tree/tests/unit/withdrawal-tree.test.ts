/* eslint-disable jest/no-disabled-tests */
/* eslint-disable jest/no-hooks */
import { nSQL } from '@nano-sql/core'
import { uuid } from '@nano-sql/core/lib/utilities'
import BN from 'bn.js'
import { toBN } from 'web3-utils'
import { Field } from '~babyjubjub'
import { schema } from '~database'
import {
  WithdrawalTree,
  TreeConfig,
  keccakHasher,
  Item,
  genesisRoot,
  verifyProof,
} from '~tree'
import { utxos } from '~dataset/testset-utxos'
import { address } from '~dataset/testset-keys'

describe('withdrawal tree unit test', () => {
  let withdrawalTree: WithdrawalTree
  const withdrawalTreeMetadata = {
    id: uuid(),
    index: 1,
    zkopruId: 'tempzkopru',
    start: Field.from(0),
    end: Field.from(0),
  }
  const depth = 31
  const withdrawalTreeConfig: TreeConfig<BN> = {
    hasher: keccakHasher(depth),
    forceUpdate: true,
    fullSync: true,
  }
  const preHashes = keccakHasher(depth).preHash
  const withdrawalTreeInitialData = {
    root: genesisRoot(keccakHasher(depth)),
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
    it('should return the genesis root value for its initial root', () => {
      expect(
        withdrawalTree.root().eq(withdrawalTreeInitialData.root),
      ).toStrictEqual(true)
    })
  })
  describe('dryAppend', () => {
    let prevRoot: BN
    let result: {
      root: BN
      index: BN
      siblings: BN[]
    }
    beforeAll(async () => {
      prevRoot = withdrawalTree.root()
      const items: Item<BN>[] = [{ leafHash: toBN(1) }, { leafHash: toBN(2) }]
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
    let prevRoot: BN
    let dryResult: {
      root: BN
      index: BN
      siblings: BN[]
    }
    let result: {
      root: BN
      index: BN
      siblings: BN[]
    }
    it('should update its root and its value should equal to the dry run', async () => {
      prevRoot = withdrawalTree.root()
      const items: Item<BN>[] = [{ leafHash: toBN(1) }, { leafHash: toBN(2) }]
      dryResult = await withdrawalTree.dryAppend(...items)
      result = await withdrawalTree.append(...items)
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
    const addresses = [address.USER_A]
    const items: Item<BN>[] = [
      utxos.utxo1_in_1.toWithdrawal({ to: address.USER_A, fee: 1 }),
      utxos.utxo1_out_1,
      utxos.utxo2_1_in_1,
    ].map(note => ({
      leafHash: toBN(note.hash().toHex()),
      note,
    }))
    it("should track Alice's utxos while not tracking Bob's", async () => {
      withdrawalTree.updateAddresses(addresses)
      await withdrawalTree.append(...items)
      const proof = await withdrawalTree.merkleProof({
        hash: items[0].leafHash,
      })
      expect(verifyProof(keccakHasher(depth), proof)).toBe(true)
    })
    it('should generate merkle proof using index together', async () => {
      const index = withdrawalTree.latestLeafIndex().subn(3)
      const proof = await withdrawalTree.merkleProof({
        hash: items[0].leafHash,
        index,
      })
      expect(verifyProof(keccakHasher(depth), proof)).toBe(true)
    })
    it('should fail to generate a merkle proof with an invalid index', async () => {
      const index = withdrawalTree.latestLeafIndex().subn(1)
      await expect(
        withdrawalTree.merkleProof({
          hash: items[0].leafHash,
          index,
        }),
      ).rejects.toThrow('')
    })
  })
})
