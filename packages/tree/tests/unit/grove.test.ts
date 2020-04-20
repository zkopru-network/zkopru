/* eslint-disable jest/no-disabled-tests */

import { InanoSQLInstance, nSQL } from '@nano-sql/core'
import { schema } from '@zkopru/database'
import { Field } from '@zkopru/babyjubjub'
import BN from 'bn.js'
import { Grove, poseidonHasher, keccakHasher, Item } from '~tree'
import { address, keys, utxos } from '../testset'

/* eslint-disable jest/no-hooks */
describe('grove full sync grove()', () => {
  const zkopruId = 'someuuid'
  let grove: Grove
  beforeAll(async () => {
    const dbName = 'grovetest'
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
        schema.block(zkopruId),
      ],
      version: 3,
    })
    const db: InanoSQLInstance = nSQL()
    grove = new Grove(zkopruId, db, {
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
    await grove.init()
  })
  it('should have nullifier tree when it has full sync option', async () => {
    expect(grove.nullifierTree).toBeDefined()
  })
  describe('setPubKeysToObserve()', () => {
    it('should register public keys to keep track for the inclusion proof for tx building', () => {
      grove.setPubKeysToObserve([keys.alicePubKey])
    })
  })
  describe('setAddressesToObserve()', () => {
    it('should set Ethereum address for withdrawal tracking', () => {
      grove.setAddressesToObserve([address.USER_A])
    })
  })
  describe('dryPatch', () => {
    it('should not update the grove', async () => {
      const prevResult = {
        utxoRoot: grove.latestUTXOTree().root(),
        utxoIndex: grove.latestUTXOTree().latestLeafIndex(),
        withdrawalRoot: grove.latestWithdrawalTree().root(),
        withdrawalIndex: grove.latestWithdrawalTree().latestLeafIndex(),
        nullifierRoot: await grove.nullifierTree?.root(),
      }
      const utxosToAppend: Item[] = [
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
        withdrawals: [Field.from(1), Field.from(2)],
        nullifiers: [Field.from(12), Field.from(23)],
      }
      await grove.dryPatch(patch)
      const postResult = {
        utxoRoot: grove.latestUTXOTree().root(),
        utxoIndex: grove.latestUTXOTree().latestLeafIndex(),
        withdrawalRoot: grove.latestWithdrawalTree().root(),
        withdrawalIndex: grove.latestWithdrawalTree().latestLeafIndex(),
        nullifierRoot: await grove.nullifierTree?.root(),
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
      const utxosToAppend: Item[] = [
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
        withdrawals: [Field.from(1), Field.from(2)],
        nullifiers: [Field.from(12), Field.from(23)],
      }
      const expected = await grove.dryPatch(patch)
      await grove.applyPatch(patch)
      const result = {
        utxoRoot: grove.latestUTXOTree().root(),
        utxoIndex: grove.latestUTXOTree().latestLeafIndex(),
        withdrawalRoot: grove.latestWithdrawalTree().root(),
        withdrawalIndex: grove.latestWithdrawalTree().latestLeafIndex(),
        nullifierRoot: await grove.nullifierTree?.root(),
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
})
