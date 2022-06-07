/**
 * @jest-environment node
 */

import path from 'path'
import { Fp } from '@zkopru/babyjubjub'
import { ZkTx, Utxo, UtxoStatus, TokenRegistry } from '@zkopru/transaction'
import { ZkWizard } from '@zkopru/zk-wizard'
import { keccakHasher, poseidonHasher, Grove } from '@zkopru/tree'
import { txSizeCalculator } from '@zkopru/utils'
import { DB, SQLiteConnector, schema } from '~database/node'
import { accounts, address } from '~dataset/testset-predefined'
import { utxos } from '~dataset/testset-utxos'
import { txs } from '~dataset/testset-txs'

async function loadGrove(db: DB): Promise<{ grove: Grove }> {
  const grove = new Grove(db, {
    utxoTreeDepth: 48,
    withdrawalTreeDepth: 48,
    nullifierTreeDepth: 254,
    utxoSubTreeSize: 32,
    withdrawalSubTreeSize: 32,
    utxoHasher: poseidonHasher(48),
    withdrawalHasher: keccakHasher(48),
    nullifierHasher: keccakHasher(254),
    fullSync: true,
    forceUpdate: true,
    zkAddressesToObserve: [accounts.alice.zkAddress, accounts.bob.zkAddress],
    addressesToObserve: [address.USER_A],
  })
  await grove.init()
  const latestTree = grove.utxoTree
  const size = latestTree ? latestTree.latestLeafIndex() : Fp.zero
  if (size.eqn(0)) {
    await db.transaction(txdb =>
      grove.applyGrovePatch(
        {
          utxos: [
            utxos.utxo1_in_1,
            utxos.utxo2_1_in_1,
            utxos.utxo2_2_in_1,
            utxos.utxo3_in_1,
            utxos.utxo3_in_2,
            utxos.utxo3_in_3,
            utxos.utxo4_in_1,
            utxos.utxo4_in_2,
            utxos.utxo4_in_3,
            utxos.utxo5_1_in_1,
            utxos.utxo5_2_in_1,
            utxos.utxo5_3_in_1,
          ].map(utxo => ({ hash: utxo.hash(), note: utxo })),
          withdrawals: [],
          nullifiers: [],
        },
        txdb,
      ),
    )
  }
  return { grove }
}

async function saveUtxos(db: DB, utxos: Utxo[]): Promise<DB> {
  for (let i = 0; i < utxos.length; i += 1) {
    const utxo = utxos[i]
    await db.create('Utxo', {
      hash: utxo
        .hash()
        .toUint256()
        .toString(),
      owner: utxo.owner.toString(),
      salt: utxo.salt.toUint256().toString(),
      eth: utxo
        .eth()
        .toUint256()
        .toString(),
      tokenAddr: utxo
        .tokenAddr()
        .toAddress()
        .toString(),
      erc20Amount: utxo
        .erc20Amount()
        .toUint256()
        .toString(),
      nft: utxo
        .nft()
        .toUint256()
        .toString(),
      status: UtxoStatus.NON_INCLUDED,
      index: i.toString(),
    })
  }
  return db
}

async function loadZkWizard(): Promise<{
  zkWizard: ZkWizard
  mockupDB: DB
}> {
  const mockupDB = await SQLiteConnector.create(schema, ':memory:')
  const { grove } = await loadGrove(mockupDB)
  await saveUtxos(mockupDB, [
    utxos.utxo1_in_1,
    utxos.utxo2_1_in_1,
    utxos.utxo2_2_in_1,
    utxos.utxo3_in_1,
    utxos.utxo3_in_2,
    utxos.utxo3_in_3,
    utxos.utxo4_in_1,
    utxos.utxo4_in_2,
    utxos.utxo4_in_3,
    utxos.utxo5_1_in_1,
    utxos.utxo5_2_in_1,
    utxos.utxo5_3_in_1,
  ])
  const keyPath = path.join(path.dirname(__filename), '../../../circuits/keys')
  const zkWizard = new ZkWizard({
    utxoTree: grove.utxoTree,
    path: keyPath,
  })
  return { zkWizard, mockupDB }
}

describe('index', () => {
  let zkWizard: ZkWizard
  let mockupDB: DB
  const tokenRegistry: TokenRegistry = new TokenRegistry()
  // eslint-disable-next-line jest/no-hooks
  beforeAll(async () => {
    const ctx = await loadZkWizard()
    zkWizard = ctx.zkWizard
    mockupDB = ctx.mockupDB
    tokenRegistry.addERC20(address.DAI)
    tokenRegistry.addERC721(address.CRYPTO_KITTIES)
  }, 60000)
  // eslint-disable-next-line jest/no-hooks
  afterAll(async () => {
    await mockupDB.close()
  })
  describe('1 input 2 output', () => {
    let zkTx1: ZkTx
    it('should shield the 1 input - 2 output transaction', async () => {
      zkTx1 = await zkWizard.shield({
        tx: txs.tx_1,
        from: accounts.alice,
      })
    }, 60000)
    it('recipient should decrypt the note', async () => {
      const note = accounts.bob.decrypt(zkTx1, tokenRegistry)
      expect(note[0]).toBeDefined()
      expect(note[0].owner.toString()).toBe(accounts.bob.zkAddress.toString())
    }, 60000)
    it('should match tx size', async () => {
      const calculatedSize = txSizeCalculator(
        txs.tx_1.inflow.length,
        txs.tx_1.outflow.length,
        0,
        !!txs.tx_1.swap,
        false,
      )
      expect(calculatedSize).toBe(zkTx1.size())
    })
  })
  describe('basic tx to send ETH spending 1 input and creating 2 output', () => {
    let zkTx: ZkTx
    it('should shield the 1 input - 2 output transaction', async () => {
      zkTx = await zkWizard.shield({
        tx: txs.tx_1,
        from: accounts.alice,
      })
    }, 60000)
    it('recipient should decrypt the note', async () => {
      const note = accounts.bob.decrypt(zkTx, tokenRegistry)
      expect(note[0]).toBeDefined()
      expect(note[0].owner.toString()).toBe(accounts.bob.zkAddress.toString())
    }, 60000)
  })
  describe('erc20 transaction', () => {
    let zkTx: ZkTx
    it('should shield the ERC20 transaction', async () => {
      zkTx = await zkWizard.shield({
        tx: txs.tx_2_1,
        from: accounts.alice,
      })
    }, 60000)
    it('recipient should decrypt the note', async () => {
      const note = accounts.bob.decrypt(zkTx, tokenRegistry)
      expect(note[0]).toBeDefined()
      expect(note[0].owner.toString()).toBe(accounts.bob.zkAddress.toString())
    }, 60000)
    it('should match tx size', async () => {
      const calculatedSize = txSizeCalculator(
        txs.tx_2_1.inflow.length,
        txs.tx_2_1.outflow.length,
        0,
        !!txs.tx_2_1.swap,
        false,
      )
      expect(calculatedSize).toBe(zkTx.size())
    })
  })
  describe('erc721 transaction', () => {
    let zkTx: ZkTx
    it('should shield the ERC721 transaction', async () => {
      zkTx = await zkWizard.shield({
        tx: txs.tx_2_2,
        from: accounts.bob,
      })
    }, 60000)
    it('recipient should decrypt the note', async () => {
      const note = accounts.alice.decrypt(zkTx, tokenRegistry)
      expect(note[0]).toBeDefined()
      expect(note[0].owner.toString()).toBe(accounts.alice.zkAddress.toString())
    }, 60000)
    it('should match tx size', async () => {
      const calculatedSize = txSizeCalculator(
        txs.tx_2_2.inflow.length,
        txs.tx_2_2.outflow.length,
        0,
        !!txs.tx_2_2.swap,
        false,
      )
      expect(calculatedSize).toBe(zkTx.size())
    })
  })
  describe('note aggregation', () => {
    let zkTx: ZkTx
    it('should shield the aggregation transaction to merge multiple notes', async () => {
      zkTx = await zkWizard.shield({
        tx: txs.tx_3,
        from: accounts.alice,
      })
    }, 60000)
    it('cannot add memo field for mixed(eth+token) note', async () => {
      const note = accounts.alice.decrypt(zkTx, tokenRegistry)
      expect(note[0]).toBeUndefined()
    }, 60000)
  })
  describe('migration transaction', () => {
    let zkTx: ZkTx
    it('should shield the migration transaction', async () => {
      zkTx = await zkWizard.shield({
        tx: txs.tx_4,
        from: accounts.alice,
      })
    }, 60000)
    it('cannot add memo field for mixed(eth+token) note', async () => {
      const note = accounts.alice.decrypt(zkTx, tokenRegistry)
      expect(note[0]).toBeUndefined()
    }, 60000)
  })

  describe('transaction size matches', () => {
    it('1 input - 1 output - no swap - v1 memo', async () => {
      const tx = txs.tx_5_1
      const calculatedSize = txSizeCalculator(
        tx.inflow.length,
        tx.outflow.length,
        0,
        !!tx.swap,
        false,
        true,
      )
      const zkTx = await zkWizard.shield({
        tx,
        from: accounts.alice,
        encryptTo: accounts.bob.zkAddress,
      })
      expect(calculatedSize).toBe(zkTx.size())
    }, 60000)

    it('1 input - 1 output - no swap - v2 memo', async () => {
      const tx = txs.tx_5_1
      const calculatedSize = txSizeCalculator(
        tx.inflow.length,
        tx.outflow.length,
        0,
        !!tx.swap,
        false,
        false,
      )
      const zkTx = await zkWizard.shield({
        tx,
        from: accounts.alice,
      })
      expect(calculatedSize).toBe(zkTx.size())
    }, 60000)

    it('1 input - 2 output - no swap - v1 memo', async () => {
      const tx = txs.tx_5_2
      const calculatedSize = txSizeCalculator(
        tx.inflow.length,
        tx.outflow.length,
        0,
        !!tx.swap,
        false,
        true,
      )
      const zkTx = await zkWizard.shield({
        tx,
        from: accounts.alice,
        encryptTo: accounts.bob.zkAddress,
      })
      expect(calculatedSize).toBe(zkTx.size())
    }, 60000)

    it('1 input - 2 output - no swap - v2 memo', async () => {
      const tx = txs.tx_5_2
      const calculatedSize = txSizeCalculator(
        tx.inflow.length,
        tx.outflow.length,
        0,
        !!tx.swap,
        false,
        false,
      )
      const zkTx = await zkWizard.shield({
        tx,
        from: accounts.alice,
      })
      expect(calculatedSize).toBe(zkTx.size())
    }, 60000)

    it('1 input - 2 output - 1 swap - v1 memo', async () => {
      const tx = txs.tx_5_3
      const calculatedSize = txSizeCalculator(
        tx.inflow.length,
        tx.outflow.length,
        0,
        !!tx.swap,
        false,
        true,
      )
      const zkTx = await zkWizard.shield({
        tx,
        from: accounts.alice,
        encryptTo: accounts.bob.zkAddress,
      })
      expect(calculatedSize).toBe(zkTx.size())
    }, 60000)

    it('1 input - 2 output - 1 swap - v2 memo', async () => {
      const tx = txs.tx_5_3
      const calculatedSize = txSizeCalculator(
        tx.inflow.length,
        tx.outflow.length,
        0,
        !!tx.swap,
        false,
        false,
      )
      const zkTx = await zkWizard.shield({
        tx,
        from: accounts.alice,
      })
      expect(calculatedSize).toBe(zkTx.size())
    }, 60000)
  })
})
