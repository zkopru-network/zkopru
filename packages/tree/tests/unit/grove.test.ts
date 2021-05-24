/* eslint-disable jest/no-disabled-tests */

import BN from 'bn.js'
import { toBN } from 'web3-utils'
import { DB, SQLiteConnector, schema } from '~database/node'
import { Fp } from '~babyjubjub'
import { Grove, poseidonHasher, keccakHasher, Leaf } from '~tree'
import { utxos } from '~dataset/testset-utxos'
import { accounts, address } from '~dataset/testset-predefined'

/* eslint-disable jest/no-hooks */
describe('grove full sync grove()', () => {
  let fullSyncGrove: Grove
  let lightSyncGrove: Grove
  let mockup: DB
  beforeAll(async () => {
    mockup = await SQLiteConnector.create(schema, ':memory:')
    fullSyncGrove = new Grove(mockup, {
      utxoTreeDepth: 31,
      withdrawalTreeDepth: 31,
      utxoSubTreeSize: 32,
      withdrawalSubTreeSize: 32,
      nullifierTreeDepth: 254,
      utxoHasher: poseidonHasher(31),
      withdrawalHasher: keccakHasher(31),
      nullifierHasher: keccakHasher(254),
      fullSync: true,
      forceUpdate: !false,
      zkAddressesToObserve: [accounts.alice.zkAddress],
      addressesToObserve: [address.USER_A],
    })
    await fullSyncGrove.init()
  })
  afterAll(async () => {
    await mockup.close()
  })
  it('should have nullifier tree when it has full sync option', async () => {
    expect(fullSyncGrove.nullifierTree).toBeDefined()
  })
  describe('setPubKeysToObserve()', () => {
    it('should register public keys to keep track for the inclusion proof for tx building', () => {
      fullSyncGrove.setZkAddressesToObserve([accounts.alice.zkAddress])
    })
  })
  describe('setAddressesToObserve()', () => {
    it('should set Ethereum address for withdrawal tracking', () => {
      fullSyncGrove.setAddressesToObserve([address.USER_A])
    })
  })
  describe('dryPatch', () => {
    it('should not update the grove', async () => {
      const prevResult = {
        utxoRoot: fullSyncGrove.utxoTree.root(),
        utxoIndex: fullSyncGrove.utxoTree.latestLeafIndex(),
        withdrawalRoot: fullSyncGrove.withdrawalTree.root(),
        withdrawalIndex: fullSyncGrove.withdrawalTree.latestLeafIndex(),
        nullifierRoot: await fullSyncGrove.nullifierTree?.root(),
      }
      const utxosToAppend: Leaf<Fp>[] = [
        utxos.utxo1_out_1,
        utxos.utxo2_1_in_1,
      ].map(note => ({
        hash: note.hash(),
        note,
        shouldTrack: true,
      }))
      const withdrawalsToAppend: Leaf<BN>[] = [
        utxos.utxo1_in_1.toWithdrawal({ to: address.USER_A, fee: 1 }),
      ].map(note => ({
        hash: note.withdrawalHash().toBN(),
        noteHash: note.hash(),
        shouldTrack: true,
      }))
      const patch = {
        header: 'sampleheader',
        utxos: utxosToAppend,
        withdrawals: withdrawalsToAppend,
        nullifiers: [Fp.from(12), Fp.from(23)],
      }
      await fullSyncGrove.dryPatch(patch)
      const postResult = {
        utxoRoot: fullSyncGrove.utxoTree.root(),
        utxoIndex: fullSyncGrove.utxoTree.latestLeafIndex(),
        withdrawalRoot: fullSyncGrove.withdrawalTree.root(),
        withdrawalIndex: fullSyncGrove.withdrawalTree.latestLeafIndex(),
        nullifierRoot: await fullSyncGrove.nullifierTree?.root(),
      }
      expect(prevResult.utxoRoot.eq(postResult.utxoRoot)).toBe(true)
      expect(prevResult.utxoIndex.eq(postResult.utxoIndex)).toBe(true)
      expect(prevResult.withdrawalRoot.eq(postResult.withdrawalRoot)).toBe(true)
      expect(prevResult.withdrawalIndex.eq(postResult.withdrawalIndex)).toBe(
        true,
      )
      expect(prevResult.nullifierRoot).toBeDefined()
      expect(postResult.nullifierRoot).toBeDefined()
      expect(
        prevResult.nullifierRoot?.eq(postResult.nullifierRoot || new BN(0)),
      ).toBe(true)
    }, 60000)
  })
  describe('applyPatch()', () => {
    it('should update the grove and have same result with the dry patch result', async () => {
      const utxosToAppend: Leaf<Fp>[] = [
        utxos.utxo1_out_1,
        utxos.utxo2_1_in_1,
      ].map(note => ({
        hash: note.hash(),
        note,
      }))
      const withdrawalsToAppend: Leaf<BN>[] = [
        utxos.utxo1_in_1.toWithdrawal({ to: address.USER_A, fee: 1 }),
      ].map(note => ({
        hash: note.withdrawalHash().toBN(),
        noteHash: note.hash(),
        shouldTrack: true,
      }))
      const patch = {
        utxos: utxosToAppend,
        withdrawals: withdrawalsToAppend,
        nullifiers: [Fp.from(12), Fp.from(23)],
      }
      const expected = await fullSyncGrove.dryPatch(patch)
      await mockup.transaction(db => fullSyncGrove.applyGrovePatch(patch, db))
      const result = {
        utxoRoot: fullSyncGrove.utxoTree.root(),
        utxoIndex: fullSyncGrove.utxoTree.latestLeafIndex(),
        withdrawalRoot: fullSyncGrove.withdrawalTree.root(),
        withdrawalIndex: fullSyncGrove.withdrawalTree.latestLeafIndex(),
        nullifierRoot: await fullSyncGrove.nullifierTree?.root(),
      }
      expect(result.utxoRoot.eq(expected.utxoTreeRoot)).toBe(true)
      expect(result.utxoIndex.eq(expected.utxoTreeIndex)).toBe(true)
      expect(result.withdrawalRoot.eq(expected.withdrawalTreeRoot)).toBe(true)
      expect(result.withdrawalIndex.eq(expected.withdrawalTreeIndex)).toBe(true)
      expect(result.nullifierRoot).toBeDefined()
      expect(expected.nullifierTreeRoot).toBeDefined()
      expect(
        result.nullifierRoot?.eq(expected.nullifierTreeRoot || new BN(0)),
      ).toBe(true)
    }, 300000)
  })
  describe('light sync grove - applyBootstrap()', () => {
    it('should update the grove using bootstrap data', async () => {
      const { utxoTree } = fullSyncGrove
      const { withdrawalTree } = fullSyncGrove
      const bootstrapData = {
        utxoStartingLeafProof: {
          ...utxoTree.getStartingLeafProof(),
          leaf: Fp.zero,
        },
        withdrawalStartingLeafProof: {
          ...withdrawalTree.getStartingLeafProof(),
          leaf: toBN(0),
        },
      }

      const mockup = await SQLiteConnector.create(schema, ':memory:')
      lightSyncGrove = new Grove(mockup, {
        utxoTreeDepth: 31,
        withdrawalTreeDepth: 31,
        utxoSubTreeSize: 32,
        withdrawalSubTreeSize: 32,
        nullifierTreeDepth: 254,
        utxoHasher: poseidonHasher(31),
        withdrawalHasher: keccakHasher(31),
        nullifierHasher: keccakHasher(254),
        fullSync: false,
        forceUpdate: !true,
        zkAddressesToObserve: [accounts.alice.zkAddress],
        addressesToObserve: [address.USER_A],
      })
      await lightSyncGrove.init()
      await lightSyncGrove.applyBootstrap(bootstrapData)
      expect(
        lightSyncGrove.utxoTree.root().eq(fullSyncGrove.utxoTree.root()),
      ).toBe(true)
      expect(
        lightSyncGrove.utxoTree
          .latestLeafIndex()
          .eq(fullSyncGrove.utxoTree.latestLeafIndex()),
      ).toBe(true)
      expect(
        lightSyncGrove.withdrawalTree
          .root()
          .eq(fullSyncGrove.withdrawalTree.root()),
      ).toBe(true)
      expect(
        lightSyncGrove.withdrawalTree
          .latestLeafIndex()
          .eq(fullSyncGrove.withdrawalTree.latestLeafIndex()),
      ).toBe(true)
      await mockup.close()
    })
  })
})
