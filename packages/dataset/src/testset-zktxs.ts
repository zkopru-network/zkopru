/* eslint-disable @typescript-eslint/camelcase */
import { nSQL, InanoSQLInstance } from '@nano-sql/core'
import { Docker } from 'node-docker-api'
import fs from 'fs-extra'
import path from 'path'
import { Field } from '@zkopru/babyjubjub'
import { ZkTx } from '@zkopru/transaction'
import { ZkWizard } from '@zkopru/zk-wizard'
import { keccakHasher, poseidonHasher, Grove } from '@zkopru/tree'
import { schema } from '@zkopru/database'
import * as utils from '@zkopru/utils'
import { Container } from 'node-docker-api/lib/container'
import tar from 'tar'
import { keys, address } from './testset-keys'
import { utxos } from './testset-utxos'
import { txs } from './testset-txs'

export async function buildKeys(keyPath: string) {
  if (!fs.existsSync(keyPath)) {
    loadCircuits()
      .then(() => {
        tar
          .c({}, ['keys/pks', 'keys/vks', 'keys/circuits'])
          .pipe(fs.createWriteStream('keys.tgz'))
      })
      .catch(console.error)
  }
}

export async function loadGrove(
  zkopruId: string,
  db: InanoSQLInstance,
): Promise<{ grove: Grove }> {
  const grove = new Grove(zkopruId, db, {
    utxoTreeDepth: 31,
    withdrawalTreeDepth: 31,
    nullifierTreeDepth: 254,
    utxoSubTreeSize: 32,
    withdrawalSubTreeSize: 32,
    utxoHasher: poseidonHasher(31),
    withdrawalHasher: keccakHasher(31),
    nullifierHasher: keccakHasher(254),
    fullSync: true,
    forceUpdate: true,
    pubKeysToObserve: [keys.alicePubKey, keys.bobPubKey],
    addressesToObserve: [address.USER_A],
  })
  await grove.init()
  const latestTree = grove.latestUTXOTree()
  const size = latestTree ? latestTree.latestLeafIndex() : Field.zero
  if (size.eqn(0)) {
    await grove.applyPatch({
      header: 'temp',
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
      ].map(utxo => ({ leafHash: utxo.hash(), note: utxo })),
      withdrawals: [],
      nullifiers: [],
    })
  }
  return { grove }
}

export async function loadCircuits() {
  const docker = new Docker({ socketPath: '/var/run/docker.sock' })
  const containerName = Math.random()
    .toString(36)
    .substring(2, 16)
  let container: Container
  try {
    container = await docker.container.create({
      Image: 'wanseob/zkopru-circuits:0.0.1',
      name: containerName,
      rm: true,
    })
  } catch {
    container = docker.container.get(containerName)
  }
  await container.start()
  const nIn = [1, 2, 3, 4]
  const nOut = [1, 2, 3, 4]
  const keyPath = path.join(path.dirname(__filename), '../keys')
  const txPath = path.join(keyPath, 'txs')
  const pkPath = path.join(keyPath, 'pks')
  const vkPath = path.join(keyPath, 'vks')
  const ccPath = path.join(keyPath, 'circuits')
  if (!fs.existsSync(txPath)) await fs.mkdirp(txPath)
  if (!fs.existsSync(pkPath)) await fs.mkdirp(pkPath)
  if (!fs.existsSync(vkPath)) await fs.mkdirp(vkPath)
  if (!fs.existsSync(ccPath)) await fs.mkdirp(ccPath)
  for (const i of nIn) {
    for (const o of nOut) {
      const circuit = await utils.readFromContainer(
        container,
        `/proj/build/circuits/zk_transaction_${i}_${o}.wasm`,
      )
      const pk = await utils.readFromContainer(
        container,
        `/proj/build/pks/zk_transaction_${i}_${o}.pk.bin`,
      )
      const vk = await utils.readFromContainer(
        container,
        `/proj/build/vks/zk_transaction_${i}_${o}.vk.json`,
      )
      fs.writeFileSync(path.join(ccPath, `zk_transaction_${i}_${o}.wasm`), circuit)
      fs.writeFileSync(path.join(pkPath, `zk_transaction_${i}_${o}.pk.bin`), pk)
      fs.writeFileSync(path.join(vkPath, `zk_transaction_${i}_${o}.vk.json`), vk)
    }
  }
  await container.stop()
  await container.delete()
}

export async function loadZkTxs(): Promise<ZkTx[]> {
  const zkopruId = 'someuuid'
  const dbName = 'test-database'
  await nSQL().createDatabase({
    id: 'test-database',
    mode: 'TEMP',
    tables: [
      schema.block,
      schema.utxo,
      schema.utxoTree,
      schema.withdrawal,
      schema.withdrawalTree,
      schema.nullifiers,
      schema.nullifierTreeNode,
    ], // TODO make the core package handle this
  })
  const db: InanoSQLInstance = nSQL().useDatabase(dbName)
  const { grove } = await loadGrove(zkopruId, db)
  const keyPath = path.join(path.dirname(__filename), '../keys')
  await buildKeys(keyPath)

  const aliceZkWizard = new ZkWizard({
    db,
    grove,
    privKey: keys.alicePrivKey,
    path: keyPath,
  })
  const bobZkWizard = new ZkWizard({
    db,
    grove,
    privKey: keys.bobPrivKey,
    path: keyPath,
  })
  const tx1Path = path.join(keyPath, 'txs/zk_tx_1.tx')
  const tx2_1Path = path.join(keyPath, 'txs/zk_tx_2_1.tx')
  const tx2_2Path = path.join(keyPath, 'txs/zk_tx_2_2.tx')
  const tx3Path = path.join(keyPath, 'txs/zk_tx_3.tx')
  const tx4Path = path.join(keyPath, 'txs/zk_tx_4.tx')
  let zk_tx_1: ZkTx
  try {
    zk_tx_1 = ZkTx.decode(fs.readFileSync(tx1Path))
  } catch (err) {
    zk_tx_1 = await aliceZkWizard.shield({ tx: txs.tx_1 })
    fs.writeFileSync(tx1Path, zk_tx_1.encode())
  }
  let zk_tx_2_1: ZkTx
  try {
    zk_tx_2_1 = ZkTx.decode(fs.readFileSync(tx2_1Path))
  } catch (err) {
    zk_tx_2_1 = await aliceZkWizard.shield({ tx: txs.tx_2_1 })
    fs.writeFileSync(tx2_1Path, zk_tx_2_1.encode())
  }
  let zk_tx_2_2: ZkTx
  try {
    zk_tx_2_2 = ZkTx.decode(fs.readFileSync(tx2_2Path))
  } catch (err) {
    zk_tx_2_2 = await bobZkWizard.shield({ tx: txs.tx_2_2 })
    fs.writeFileSync(tx2_2Path, zk_tx_2_2.encode())
  }
  let zk_tx_3: ZkTx
  try {
    zk_tx_3 = ZkTx.decode(fs.readFileSync(tx3Path))
  } catch (err) {
    zk_tx_3 = await aliceZkWizard.shield({ tx: txs.tx_3 })
    fs.writeFileSync(tx3Path, zk_tx_3.encode())
  }
  let zk_tx_4: ZkTx
  try {
    zk_tx_4 = ZkTx.decode(fs.readFileSync(tx4Path))
  } catch (err) {
    zk_tx_4 = await aliceZkWizard.shield({ tx: txs.tx_4 })
    fs.writeFileSync(tx4Path, zk_tx_4.encode())
  }
  await aliceZkWizard.terminate()
  await bobZkWizard.terminate()
  return [zk_tx_1, zk_tx_2_1, zk_tx_2_2, zk_tx_3, zk_tx_4]
}
