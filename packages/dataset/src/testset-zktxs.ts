/* eslint-disable @typescript-eslint/camelcase */
import fs from 'fs-extra'
import path from 'path'
import { Field } from '@zkopru/babyjubjub'
import { ZkTx, Utxo, UtxoStatus } from '@zkopru/transaction'
import { ZkWizard } from '@zkopru/zk-wizard'
import { keccakHasher, poseidonHasher, Grove } from '@zkopru/tree'
import * as utils from '@zkopru/utils'
import tar from 'tar'
import { DB, TreeSpecies } from '@zkopru/prisma'
import { accounts, address } from './testset-keys'
import { utxos } from './testset-utxos'
import { txs } from './testset-txs'

export async function loadCircuits() {
  // It may take about an hour. If you want to skip building image,
  // run `yarn pull:images` on the root directory
  const container = await utils.buildAndGetContainer({
    compose: [__dirname, '../../../dockerfiles'],
    service: 'circuits',
  })
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
      fs.writeFileSync(
        path.join(ccPath, `zk_transaction_${i}_${o}.wasm`),
        circuit,
      )
      fs.writeFileSync(path.join(pkPath, `zk_transaction_${i}_${o}.pk.bin`), pk)
      fs.writeFileSync(
        path.join(vkPath, `zk_transaction_${i}_${o}.vk.json`),
        vk,
      )
    }
  }
  await container.stop()
  await container.delete()
}

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
  const latestTree = grove.latestUTXOTree()
  const size = latestTree ? latestTree.latestLeafIndex() : Field.zero
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
  const utxoTree = await db.read(prisma =>
    prisma.lightTree.findOne({
      where: { species_treeIndex: { species: TreeSpecies.UTXO, treeIndex: 0 } },
    }),
  )
  if (!utxoTree) throw Error('Failed to get utxo gree from grove')
  const utxoTreeId = utxoTree.id
  for (let i = 0; i < utxos.length; i += 1) {
    const utxo = utxos[i]
    await db.write(prisma =>
      prisma.utxo.create({
        data: {
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
          tree: { connect: { id: utxoTreeId } },
        },
      }),
    )
  }
  return db
}

export async function loadZkTxs(): Promise<ZkTx[]> {
  const mockupDB = await DB.mockup()
  const { grove } = await loadGrove(mockupDB.db)
  await saveUtxos(mockupDB.db, [
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
  await buildKeys(keyPath)

  const zkWizard = new ZkWizard({
    grove,
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
    zk_tx_1 = await zkWizard.shield({
      tx: txs.tx_1,
      account: accounts.alice,
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
      account: accounts.alice,
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
      account: accounts.bob,
      encryptTo: accounts.alice.zkAddress,
    })
    fs.writeFileSync(tx2_2Path, zk_tx_2_2.encode())
  }
  let zk_tx_3: ZkTx
  try {
    zk_tx_3 = ZkTx.decode(fs.readFileSync(tx3Path))
  } catch (err) {
    zk_tx_3 = await zkWizard.shield({ tx: txs.tx_3, account: accounts.alice })
    fs.writeFileSync(tx3Path, zk_tx_3.encode())
  }
  let zk_tx_4: ZkTx
  try {
    zk_tx_4 = ZkTx.decode(fs.readFileSync(tx4Path))
  } catch (err) {
    zk_tx_4 = await zkWizard.shield({ tx: txs.tx_4, account: accounts.alice })
    fs.writeFileSync(tx4Path, zk_tx_4.encode())
  }
  await zkWizard.terminate()
  await mockupDB.terminate()
  return [zk_tx_1, zk_tx_2_1, zk_tx_2_2, zk_tx_3, zk_tx_4]
}
