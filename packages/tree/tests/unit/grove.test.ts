/* eslint-disable jest/no-disabled-tests */

import { InanoSQLInstance, nSQL } from '@nano-sql/core'
import BN from 'bn.js'
import { toBN } from 'web3-utils'
import { schema } from '~database'
import { Field } from '~babyjubjub'
import { Grove, poseidonHasher, keccakHasher, Item } from '~tree'
import { utxos } from '~dataset/testset-utxos'
import { address, keys } from '~dataset/testset-keys'

/* eslint-disable jest/no-hooks */
describe('grove full sync grove()', () => {
  const zkopruId = 'someuuid'
  let fullSyncGrvoe: Grove
  let lightSyncGrove: Grove
  beforeAll(async () => {
    const dbName = 'fullSyncGrove'
    await nSQL().createDatabase({
      id: dbName,
      mode: 'TEMP',
      tables: [
        schema.utxo,
        schema.utxoTree,
        schema.withdrawal,
        schema.withdrawalTree,
        schema.nullifiers,
        schema.nullifierTreeNode,
        schema.block,
      ],
      version: 3,
    })
    const db: InanoSQLInstance = nSQL().useDatabase(dbName)
    fullSyncGrvoe = new Grove(zkopruId, db, {
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
      pubKeysToObserve: [keys.alicePubKey],
      addressesToObserve: [address.USER_A],
    })
    await fullSyncGrvoe.init()
  })
  it('should have nullifier tree when it has full sync option', async () => {
    expect(fullSyncGrvoe.nullifierTree).toBeDefined()
  })
  describe('setPubKeysToObserve()', () => {
    it('should register public keys to keep track for the inclusion proof for tx building', () => {
      fullSyncGrvoe.setPubKeysToObserve([keys.alicePubKey])
    })
  })
  describe('setAddressesToObserve()', () => {
    it('should set Ethereum address for withdrawal tracking', () => {
      fullSyncGrvoe.setAddressesToObserve([address.USER_A])
    })
  })
  describe('dryPatch', () => {
    it('should not update the grove', async () => {
      const prevResult = {
        utxoRoot: fullSyncGrvoe.latestUTXOTree().root(),
        utxoIndex: fullSyncGrvoe.latestUTXOTree().latestLeafIndex(),
        withdrawalRoot: fullSyncGrvoe.latestWithdrawalTree().root(),
        withdrawalIndex: fullSyncGrvoe.latestWithdrawalTree().latestLeafIndex(),
        nullifierRoot: await fullSyncGrvoe.nullifierTree?.root(),
      }
      const utxosToAppend: Item<Field>[] = [
        utxos.utxo1_in_1.toWithdrawal({ to: address.USER_A, fee: 1 }),
        utxos.utxo1_out_1,
        utxos.utxo2_1_in_1,
      ].map(note => ({
        leafHash: note.hash(),
        note,
      }))
      const patch = {
        header: 'sampleheader',
        utxos: utxosToAppend,
        withdrawals: [toBN(1), toBN(2)],
        nullifiers: [toBN(12), toBN(23)],
      }
      await fullSyncGrvoe.dryPatch(patch)
      const postResult = {
        utxoRoot: fullSyncGrvoe.latestUTXOTree().root(),
        utxoIndex: fullSyncGrvoe.latestUTXOTree().latestLeafIndex(),
        withdrawalRoot: fullSyncGrvoe.latestWithdrawalTree().root(),
        withdrawalIndex: fullSyncGrvoe.latestWithdrawalTree().latestLeafIndex(),
        nullifierRoot: await fullSyncGrvoe.nullifierTree?.root(),
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
    })
  })
  describe('applyPatch()', () => {
    it('should update the grove and have same result with the dry patch result', async () => {
      const utxosToAppend: Item<Field>[] = [
        utxos.utxo1_in_1.toWithdrawal({ to: address.USER_A, fee: 1 }),
        utxos.utxo1_out_1,
        utxos.utxo2_1_in_1,
      ].map(note => ({
        leafHash: note.hash(),
        note,
      }))
      const patch = {
        header: 'sampleheader',
        utxos: utxosToAppend,
        withdrawals: [toBN(1), toBN(2)],
        nullifiers: [toBN(12), toBN(23)],
      }
      const expected = await fullSyncGrvoe.dryPatch(patch)
      await fullSyncGrvoe.applyPatch(patch)
      const result = {
        utxoRoot: fullSyncGrvoe.latestUTXOTree().root(),
        utxoIndex: fullSyncGrvoe.latestUTXOTree().latestLeafIndex(),
        withdrawalRoot: fullSyncGrvoe.latestWithdrawalTree().root(),
        withdrawalIndex: fullSyncGrvoe.latestWithdrawalTree().latestLeafIndex(),
        nullifierRoot: await fullSyncGrvoe.nullifierTree?.root(),
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
    })
  })
  describe('light sync grove - applyBootstrap()', () => {
    it('should update the grove using bootstrap data', async () => {
      const latestUtxoTree = fullSyncGrvoe.latestUTXOTree()
      const latestWithdrawalTree = fullSyncGrvoe.latestWithdrawalTree()
      const bootstrapData = {
        utxoTreeIndex: latestUtxoTree.metadata.index,
        utxoStartingLeafProof: {
          ...latestUtxoTree.getStartingLeafProof(),
          leaf: Field.zero,
        },
        withdrawalTreeIndex: latestWithdrawalTree.metadata.index,
        withdrawalStartingLeafProof: {
          ...latestWithdrawalTree.getStartingLeafProof(),
          leaf: toBN(0),
        },
      }

      const dbName = 'ligthSyncGrove'
      await nSQL().createDatabase({
        id: dbName,
        mode: 'TEMP',
        tables: [
          schema.utxo,
          schema.utxoTree,
          schema.withdrawal,
          schema.withdrawalTree,
          schema.nullifiers,
          schema.nullifierTreeNode,
          schema.block,
        ],
        version: 3,
      })
      const db: InanoSQLInstance = nSQL().useDatabase(dbName)
      lightSyncGrove = new Grove(zkopruId, db, {
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
        pubKeysToObserve: [keys.alicePubKey],
        addressesToObserve: [address.USER_A],
      })
      await lightSyncGrove.init()
      await lightSyncGrove.applyBootstrap(bootstrapData)
      expect(
        lightSyncGrove
          .latestUTXOTree()
          .root()
          .eq(fullSyncGrvoe.latestUTXOTree().root()),
      ).toBe(true)
      expect(
        lightSyncGrove
          .latestUTXOTree()
          .latestLeafIndex()
          .eq(fullSyncGrvoe.latestUTXOTree().latestLeafIndex()),
      ).toBe(true)
      expect(
        lightSyncGrove
          .latestWithdrawalTree()
          .root()
          .eq(fullSyncGrvoe.latestWithdrawalTree().root()),
      ).toBe(true)
      expect(
        lightSyncGrove
          .latestWithdrawalTree()
          .latestLeafIndex()
          .eq(fullSyncGrvoe.latestWithdrawalTree().latestLeafIndex()),
      ).toBe(true)
    })
  })
})
