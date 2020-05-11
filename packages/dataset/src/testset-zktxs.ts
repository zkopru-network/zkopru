/* eslint-disable @typescript-eslint/camelcase */
import { nSQL, InanoSQLInstance } from '@nano-sql/core'
import { Docker } from 'node-docker-api'
import fs from 'fs-extra'
import { Field } from '@zkopru/babyjubjub'
import { ZkTx } from '@zkopru/transaction'
import { ZkWizard } from '@zkopru/zk-wizard'
import { keccakHasher, poseidonHasher, Grove } from '@zkopru/tree'
import { schema } from '@zkopru/database'
import * as utils from '@zkopru/utils'
import { Container } from 'node-docker-api/lib/container'
import { keys, address } from './testset-keys'
import { utxos } from './testset-utxos'
import { txs } from './testset-txs'

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

export async function loadCircuits(): Promise<{
  circuit_1_2: any
  circuit_1_2_pk: any
  circuit_3_1: any
  circuit_3_1_pk: any
  circuit_3_3: any
  circuit_3_3_pk: any
}> {
  const docker = new Docker({ socketPath: '/var/run/docker.sock' })
  const containerName = Math.random()
    .toString(36)
    .substring(2, 16)
  let container: Container
  try {
    container = await docker.container.create({
      Image: 'zkopru:circuits',
      name: containerName,
      rm: true,
    })
  } catch {
    container = docker.container.get(containerName)
  }
  await container.start()
  // const circuit_1_2 = fs.readFileSync(
  //   '../circuits/build/circuits/zk_transaction_1_2.wasm',
  // )
  // const circuit_3_1 = fs.readFileSync(
  //   '../circuits/build/circuits/zk_transaction_3_1.wasm',
  // )
  // const circuit_3_3 = fs.readFileSync(
  //   '../circuits/build/circuits/zk_transaction_3_3.wasm',
  // )
  const circuit_1_2 = await utils.readFromContainer(
    container,
    '/proj/build/circuits/zk_transaction_1_2.wasm',
  )
  const circuit_3_1 = await utils.readFromContainer(
    container,
    '/proj/build/circuits/zk_transaction_3_1.wasm',
  )
  const circuit_3_3 = await utils.readFromContainer(
    container,
    '/proj/build/circuits/zk_transaction_3_3.wasm',
  )
  const circuit_1_2_pk = JSON.parse(
    (
      await utils.readFromContainer(
        container,
        '/proj/build/pks/zk_transaction_1_2.pk.json',
      )
    ).toString('utf8'),
  )
  const circuit_3_1_pk = JSON.parse(
    (
      await utils.readFromContainer(
        container,
        '/proj/build/pks/zk_transaction_3_1.pk.json',
      )
    ).toString('utf8'),
  )
  const circuit_3_3_pk = JSON.parse(
    (
      await utils.readFromContainer(
        container,
        '/proj/build/pks/zk_transaction_3_3.pk.json',
      )
    ).toString('utf8'),
  )
  await container.stop()
  await container.delete()
  return {
    circuit_1_2,
    circuit_1_2_pk,
    circuit_3_1,
    circuit_3_1_pk,
    circuit_3_3,
    circuit_3_3_pk,
  }
}

export async function loadZkTxs(): Promise<ZkTx[]> {
  const zkopruId = 'someuuid'
  const dbName = 'test-database'
  await nSQL().createDatabase({
    id: 'test-database',
    mode: 'TEMP',
    tables: [
      schema.utxo,
      schema.utxoTree,
      schema.withdrawal,
      schema.withdrawalTree,
      schema.nullifiers,
      schema.nullifierTreeNode,
      schema.block(zkopruId),
    ], // TODO make the core package handle this
  })
  const db: InanoSQLInstance = nSQL().useDatabase(dbName)
  const { grove } = await loadGrove(zkopruId, db)
  const aliceZkWizard = new ZkWizard({
    db,
    grove,
    privKey: keys.alicePrivKey,
  })
  const bobZkWizard = new ZkWizard({
    db,
    grove,
    privKey: keys.bobPrivKey,
  })
  const {
    circuit_1_2,
    circuit_1_2_pk,
    circuit_3_1,
    circuit_3_1_pk,
    circuit_3_3,
    circuit_3_3_pk,
  } = await loadCircuits()
  aliceZkWizard.addCircuit({
    nInput: 1,
    nOutput: 2,
    wasm: circuit_1_2,
    provingKey: circuit_1_2_pk,
  })
  aliceZkWizard.addCircuit({
    nInput: 3,
    nOutput: 1,
    wasm: circuit_3_1,
    provingKey: circuit_3_1_pk,
  })
  aliceZkWizard.addCircuit({
    nInput: 3,
    nOutput: 3,
    wasm: circuit_3_3,
    provingKey: circuit_3_3_pk,
  })
  bobZkWizard.addCircuit({
    nInput: 1,
    nOutput: 2,
    wasm: circuit_1_2,
    provingKey: circuit_1_2_pk,
  })
  const tx1Path = '.data/txs/zk_tx_1.tx'
  const tx2_1Path = '.data/txs/zk_tx_2_1.tx'
  const tx2_2Path = '.data/txs/zk_tx_2_2.tx'
  const tx3Path = '.data/txs/zk_tx_3.tx'
  const tx4Path = '.data/txs/zk_tx_4.tx'
  if (!fs.existsSync('.data/txs')) await fs.mkdirp('.data/txs')
  let zk_tx_1: ZkTx
  try {
    zk_tx_1 = ZkTx.decode(fs.readFileSync(tx1Path))
  } catch (err) {
    if (!err.message.startsWith('ENOENT')) throw err
    zk_tx_1 = await aliceZkWizard.shield({ tx: txs.tx_1 })
    fs.writeFileSync(tx1Path, zk_tx_1.encode())
  }
  let zk_tx_2_1: ZkTx
  try {
    zk_tx_2_1 = ZkTx.decode(fs.readFileSync(tx2_1Path))
  } catch (err) {
    if (!err.message.startsWith('ENOENT')) throw err
    zk_tx_2_1 = await aliceZkWizard.shield({ tx: txs.tx_2_1 })
    fs.writeFileSync(tx2_1Path, zk_tx_2_1.encode())
  }
  let zk_tx_2_2: ZkTx
  try {
    zk_tx_2_2 = ZkTx.decode(fs.readFileSync(tx2_2Path))
  } catch (err) {
    if (!err.message.startsWith('ENOENT')) throw err
    zk_tx_2_2 = await bobZkWizard.shield({ tx: txs.tx_2_2 })
    fs.writeFileSync(tx2_2Path, zk_tx_2_2.encode())
  }
  let zk_tx_3: ZkTx
  try {
    zk_tx_3 = ZkTx.decode(fs.readFileSync(tx3Path))
  } catch (err) {
    if (!err.message.startsWith('ENOENT')) throw err
    zk_tx_3 = await aliceZkWizard.shield({ tx: txs.tx_3 })
    fs.writeFileSync(tx3Path, zk_tx_3.encode())
  }
  let zk_tx_4: ZkTx
  try {
    zk_tx_4 = ZkTx.decode(fs.readFileSync(tx4Path))
  } catch (err) {
    if (!err.message.startsWith('ENOENT')) throw err
    zk_tx_4 = await aliceZkWizard.shield({ tx: txs.tx_4 })
    fs.writeFileSync(tx4Path, zk_tx_4.encode())
  }
  await aliceZkWizard.terminate()
  await bobZkWizard.terminate()
  return [zk_tx_1, zk_tx_2_1, zk_tx_2_2, zk_tx_3, zk_tx_4]
}
