/* eslint-disable jest/no-disabled-tests */
/* eslint-disable jest/no-hooks */
import BN from 'bn.js'
import { toBN } from 'web3-utils'
import { Fp } from '~babyjubjub'
import { DB, TreeSpecies, SQLiteConnector, schema } from '~database'
import {
  WithdrawalTree,
  TreeConfig,
  keccakHasher,
  Leaf,
  genesisRoot,
  verifyProof,
} from '~tree'
import { utxos } from '~dataset/testset-utxos'
import { address } from '~dataset/testset-predefined'

describe('withdrawal tree unit test', () => {
  let withdrawalTree: WithdrawalTree
  const withdrawalTreeMetadata = {
    id: '2',
    index: 1,
    species: TreeSpecies.WITHDRAWAL,
    start: Fp.from(0),
    end: Fp.from(0),
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
    index: Fp.zero,
    siblings: preHashes.slice(0, -1),
  }
  let mockup: DB
  beforeAll(async () => {
    mockup = await SQLiteConnector.create(':memory:')
    await mockup.createTables(schema as any)
    withdrawalTree = new WithdrawalTree({
      db: mockup,
      metadata: withdrawalTreeMetadata,
      data: withdrawalTreeInitialData,
      config: withdrawalTreeConfig,
    })
    await withdrawalTree.init()
  })
  afterAll(async () => {
    await mockup.close()
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
      const items: Leaf<BN>[] = [{ hash: toBN(1) }, { hash: toBN(2) }]
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
      const items: Leaf<BN>[] = [{ hash: toBN(1) }, { hash: toBN(2) }]
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
    const items: Leaf<BN>[] = [
      utxos.utxo1_in_1.toWithdrawal({ to: address.USER_A, fee: 1 }),
      utxos.utxo1_out_1.toWithdrawal({ to: address.USER_A, fee: 1 }),
      utxos.utxo2_1_in_1.toWithdrawal({ to: address.USER_A, fee: 1 }),
    ].map(note => ({
      hash: note.withdrawalHash().toBN(),
      noteHash: note.hash(),
      shouldTrack: true,
    }))
    it("should track Alice's utxos while not tracking Bob's", async () => {
      withdrawalTree.updateAddresses(addresses)
      await withdrawalTree.append(...items)
      const proof = await withdrawalTree.merkleProof({
        hash: items[0].hash,
      })
      expect(verifyProof(keccakHasher(depth), proof)).toBe(true)
    })
    it('should generate merkle proof using index together', async () => {
      const index = withdrawalTree.latestLeafIndex().subn(3)
      const proof = await withdrawalTree.merkleProof({
        hash: items[0].hash,
        index,
      })
      expect(verifyProof(keccakHasher(depth), proof)).toBe(true)
    })
    it('should fail to generate a merkle proof with an invalid index', async () => {
      const index = withdrawalTree.latestLeafIndex().subn(1)
      await expect(
        withdrawalTree.merkleProof({
          hash: items[0].hash,
          index,
        }),
      ).rejects.toThrow('')
    })
  })
})
