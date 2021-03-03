/* eslint-disable @typescript-eslint/camelcase */
import fs from 'fs-extra'
import path from 'path'
import { Fp } from '@zkopru/babyjubjub'
import { ZkTx, Utxo, UtxoStatus } from '@zkopru/transaction'
import { ZkWizard } from '@zkopru/zk-wizard'
import { keccakHasher, poseidonHasher, Grove } from '@zkopru/tree'
import { DB, SQLiteConnector, TreeSpecies } from '@zkopru/database'
import { accounts, address } from './testset-predefined'
import { utxos } from './testset-utxos'
import { txs } from './testset-txs'
import { loadKeys } from './testset-keys'

export async function loadGrove(db: DB): Promise<{ grove: Grove }> {
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
    await grove.applyGrovePatch({
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
      ].map(utxo => ({ hash: utxo.hash(), note: utxo })),
      withdrawals: [],
      nullifiers: [],
    })
  }
  return { grove }
}

export async function saveUtxos(db: DB, utxos: Utxo[]): Promise<DB> {
  const utxoTree = await db.findOne('LightTree', {
    where: {
      species: TreeSpecies.UTXO,
    }
  })
  if (!utxoTree) throw Error('Failed to get utxo gree from grove')
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

export async function loadZkTxs(): Promise<ZkTx[]> {
  const mockupDB = await SQLiteConnector.create(':memory:')
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
  ])
  const keyPath = path.join(path.dirname(__filename), '../keys')
  const txsPath = path.join(path.dirname(__filename), '../txs')
  if (!fs.existsSync(txsPath)) {
    fs.mkdirSync(txsPath)
  }
  await loadKeys(keyPath)

  const zkWizard = new ZkWizard({
    utxoTree: grove.utxoTree,
    path: keyPath,
  })
  const tx1Path = path.join(txsPath, 'zk_tx_1.tx')
  const tx2_1Path = path.join(txsPath, 'zk_tx_2_1.tx')
  const tx2_2Path = path.join(txsPath, 'zk_tx_2_2.tx')
  const tx3Path = path.join(txsPath, 'zk_tx_3.tx')
  const tx4Path = path.join(txsPath, 'zk_tx_4.tx')
  let zk_tx_1: ZkTx
  try {
    zk_tx_1 = ZkTx.decode(fs.readFileSync(tx1Path))
  } catch (err) {
    zk_tx_1 = await zkWizard.shield({
      tx: txs.tx_1,
      from: accounts.alice,
      encryptTo: accounts.bob.zkAddress,
    })
    fs.writeFileSync(tx1Path, zk_tx_1.encode())
  }
  let zk_tx_2_1: ZkTx
  try {
    zk_tx_2_1 = ZkTx.decode(fs.readFileSync(tx2_1Path))
  } catch (err) {
    zk_tx_2_1 = await zkWizard.shield({
      tx: txs.tx_2_1,
      from: accounts.alice,
      encryptTo: accounts.bob.zkAddress,
    })
    fs.writeFileSync(tx2_1Path, zk_tx_2_1.encode())
  }
  let zk_tx_2_2: ZkTx
  try {
    zk_tx_2_2 = ZkTx.decode(fs.readFileSync(tx2_2Path))
  } catch (err) {
    zk_tx_2_2 = await zkWizard.shield({
      tx: txs.tx_2_2,
      from: accounts.bob,
      encryptTo: accounts.alice.zkAddress,
    })
    fs.writeFileSync(tx2_2Path, zk_tx_2_2.encode())
  }
  let zk_tx_3: ZkTx
  try {
    zk_tx_3 = ZkTx.decode(fs.readFileSync(tx3Path))
  } catch (err) {
    zk_tx_3 = await zkWizard.shield({ tx: txs.tx_3, from: accounts.alice })
    fs.writeFileSync(tx3Path, zk_tx_3.encode())
  }
  let zk_tx_4: ZkTx
  try {
    zk_tx_4 = ZkTx.decode(fs.readFileSync(tx4Path))
  } catch (err) {
    zk_tx_4 = await zkWizard.shield({ tx: txs.tx_4, from: accounts.alice })
    fs.writeFileSync(tx4Path, zk_tx_4.encode())
  }
  await mockupDB.close()
  return [zk_tx_1, zk_tx_2_1, zk_tx_2_2, zk_tx_3, zk_tx_4]
}
