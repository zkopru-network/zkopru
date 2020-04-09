/* eslint-disable @typescript-eslint/camelcase */
import { RocksDB } from '@nano-sql/adapter-rocksdb'
import { nanoSQL, nSQL } from '@nano-sql/core'
import fs from 'fs-extra'
import { Field, Point } from '@zkopru/babyjubjub'
import { RawTx, ZkTx, Output, TokenUtils } from '@zkopru/transaction'
import { ZkWizard } from '@zkopru/zk-wizard'
import { keccakHasher, poseidonHasher, Grove } from '@zkopru/tree'

const alicePrivKey = "I am Alice's private key"
const alicePubKey: Point = Point.fromPrivKey(alicePrivKey)
const bobPrivKey = "I am Bob's private key"
const bobPubKey: Point = Point.fromPrivKey(bobPrivKey)

const utxo1_in_1: Output = Output.newEtherNote({
  eth: 3333,
  pubKey: alicePubKey,
  salt: 11,
})
const utxo1_out_1: Output = Output.newEtherNote({
  eth: 2221,
  pubKey: bobPubKey,
  salt: 12,
})
const utxo1_out_2: Output = Output.newEtherNote({
  eth: 1111,
  pubKey: alicePubKey,
  salt: 13,
})

const utxo2_1_in_1: Output = Output.newERC20Note({
  eth: 22222333333,
  tokenAddr: TokenUtils.DAI,
  erc20Amount: 8888,
  pubKey: alicePubKey,
  salt: 14,
})
const utxo2_1_out_1: Output = Output.newERC20Note({
  eth: 22222333332,
  tokenAddr: TokenUtils.DAI,
  erc20Amount: 5555,
  pubKey: alicePubKey,
  salt: 15,
})
const utxo2_1_out_2: Output = Output.newERC20Note({
  eth: 0,
  tokenAddr: TokenUtils.DAI,
  erc20Amount: 3333,
  pubKey: bobPubKey,
  salt: 16,
})

const KITTY_1 =
  '0x0078917891789178917891789178917891789178917891789178917891789178'
const KITTY_2 =
  '0x0022222222222222222222222222222222222222222222222222222222222222'

/** Ganache pre-defined addresses */
const USER_A = '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1'
const CONTRACT_B = '0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0'

const utxo2_2_in_1: Output = Output.newNFTNote({
  eth: 7777777777,
  tokenAddr: TokenUtils.CRYPTO_KITTIES,
  nft: KITTY_1,
  pubKey: bobPubKey,
  salt: 17,
})
const utxo2_2_out_1: Output = Output.newEtherNote({
  eth: 7777777776,
  pubKey: bobPubKey,
  salt: 18,
})
const utxo2_2_out_2: Output = Output.newNFTNote({
  eth: 0,
  tokenAddr: TokenUtils.CRYPTO_KITTIES,
  nft: KITTY_1,
  pubKey: alicePubKey,
  salt: 19,
})

const utxo3_in_1: Output = Output.newEtherNote({
  eth: 111111111111111,
  pubKey: alicePubKey,
  salt: 21,
})
const utxo3_in_2: Output = Output.newEtherNote({
  eth: 222222222222222,
  pubKey: alicePubKey,
  salt: 22,
})
const utxo3_in_3: Output = Output.newEtherNote({
  eth: 333333333333333,
  pubKey: alicePubKey,
  salt: 23,
})
const utxo3_out_1: Output = Output.newEtherNote({
  eth: 666666666666664,
  pubKey: alicePubKey,
  salt: 24,
})
utxo3_out_1.markAsWithdrawal({ to: Field.from(USER_A), fee: Field.from(1) })

const utxo4_in_1: Output = Output.newEtherNote({
  eth: 8888888888888,
  pubKey: alicePubKey,
  salt: 25,
})
const utxo4_in_2: Output = Output.newERC20Note({
  eth: 0,
  tokenAddr: TokenUtils.DAI,
  erc20Amount: 5555,
  pubKey: alicePubKey,
  salt: 26,
})
const utxo4_in_3: Output = Output.newNFTNote({
  eth: 0,
  tokenAddr: TokenUtils.CRYPTO_KITTIES,
  nft: KITTY_2,
  pubKey: alicePubKey,
  salt: 27,
})
const utxo4_out_1: Output = Output.newEtherNote({
  eth: 8888888888884,
  pubKey: alicePubKey,
  salt: 28,
}) // fee for tx & fee for withdrawal for each utxos
const utxo4_out_2: Output = Output.newERC20Note({
  eth: 0,
  tokenAddr: TokenUtils.DAI,
  erc20Amount: 5555,
  pubKey: alicePubKey,
  salt: 29,
})
const utxo4_out_3: Output = Output.newNFTNote({
  eth: 0,
  tokenAddr: TokenUtils.CRYPTO_KITTIES,
  nft: KITTY_2,
  pubKey: alicePubKey,
  salt: 30,
})
utxo4_out_1.markAsMigration({ to: Field.from(CONTRACT_B), fee: Field.from(1) })
utxo4_out_2.markAsMigration({ to: Field.from(CONTRACT_B), fee: Field.from(1) })
utxo4_out_3.markAsMigration({ to: Field.from(CONTRACT_B), fee: Field.from(1) })

const tx_1: RawTx = {
  inflow: [utxo1_in_1],
  outflow: [utxo1_out_1, utxo1_out_2],
  fee: Field.from(1),
}

const tx_2_1: RawTx = {
  inflow: [utxo2_1_in_1],
  outflow: [utxo2_1_out_1, utxo2_1_out_2],
  swap: utxo2_2_out_2.hash(),
  fee: Field.from(1),
}

const tx_2_2: RawTx = {
  inflow: [utxo2_2_in_1],
  outflow: [utxo2_2_out_1, utxo2_2_out_2],
  swap: utxo2_1_out_2.hash(),
  fee: Field.from(1),
}

const tx_3: RawTx = {
  inflow: [utxo3_in_1, utxo3_in_2, utxo3_in_3],
  outflow: [utxo3_out_1],
  fee: Field.from(1),
}

const tx_4: RawTx = {
  inflow: [utxo4_in_1, utxo4_in_2, utxo4_in_3],
  outflow: [utxo4_out_1, utxo4_out_2, utxo4_out_3],
  fee: Field.from(1),
}

export const keys = {
  alicePrivKey,
  alicePubKey,
  bobPrivKey,
  bobPubKey,
}

export const address = {
  USER_A,
  CONTRACT_B,
  CRYPTO_KITTIES: TokenUtils.CRYPTO_KITTIES,
  DAI: TokenUtils.DAI,
}

export const nfts = {
  KITTY_1,
  KITTY_2,
}

export const utxos = {
  utxo1_in_1,
  utxo1_out_1,
  utxo1_out_2,
  utxo2_1_in_1,
  utxo2_1_out_1,
  utxo2_2_in_1,
  utxo2_2_out_1,
  utxo2_2_out_2,
  utxo3_in_1,
  utxo3_in_2,
  utxo3_in_3,
  utxo3_out_1,
  utxo4_in_1,
  utxo4_in_2,
  utxo4_in_3,
  utxo4_out_1,
  utxo4_out_2,
  utxo4_out_3,
}

export const txs = {
  tx_1,
  tx_2_1,
  tx_2_2,
  tx_3,
  tx_4,
}

export interface TestSet {
  utxoGrove: Grove
  zkTxs: ZkTx[]
  closeDB: () => Promise<void>
}

export async function loadGrove(db: nanoSQL): Promise<{ grove: Grove }> {
  const grove = new Grove('zkopru', db, {
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
    pubKeysToObserve: [alicePubKey, bobPubKey],
    addressesToObserve: [],
  })
  await grove.init()
  const latestTree = grove.latestUTXOTree()
  const size = latestTree ? latestTree.latestLeafIndex() : Field.zero
  if (size.equal(0)) {
    await grove.appendUTXOs(
      ...[
        utxo1_in_1,
        utxo2_1_in_1,
        utxo2_2_in_1,
        utxo3_in_1,
        utxo3_in_2,
        utxo3_in_3,
        utxo4_in_1,
        utxo4_in_2,
        utxo4_in_3,
      ].map(utxo => ({ leafHash: utxo.hash(), utxo })),
    )
  }
  return { grove }
}

export function loadCircuits(): {
  circuit_1_2: any
  circuit_1_2_pk: any
  circuit_3_1: any
  circuit_3_1_pk: any
  circuit_3_3: any
  circuit_3_3_pk: any
} {
  const circuit_1_2 = JSON.parse(
    fs.readFileSync('build/circuits.test/zk_transaction_1_2.test.json', 'utf8'),
  )
  const circuit_3_1 = JSON.parse(
    fs.readFileSync('build/circuits.test/zk_transaction_3_1.test.json', 'utf8'),
  )
  const circuit_3_3 = JSON.parse(
    fs.readFileSync('build/circuits.test/zk_transaction_3_3.test.json', 'utf8'),
  )
  const circuit_1_2_pk = JSON.parse(
    fs.readFileSync('build/pks.test/zk_transaction_1_2.test.pk.json', 'utf8'),
  )
  const circuit_3_1_pk = JSON.parse(
    fs.readFileSync('build/pks.test/zk_transaction_3_1.test.pk.json', 'utf8'),
  )
  const circuit_3_3_pk = JSON.parse(
    fs.readFileSync('build/pks.test/zk_transaction_3_3.test.pk.json', 'utf8'),
  )
  return {
    circuit_1_2,
    circuit_1_2_pk,
    circuit_3_1,
    circuit_3_1_pk,
    circuit_3_3,
    circuit_3_3_pk,
  }
}

export function loadPrebuiltZkTxs(): ZkTx[] {
  const prebuiltTxs = [
    'data/txs/zk_tx_1.tx',
    'data/txs/zk_tx_2_1.tx',
    'data/txs/zk_tx_2_2.tx',
    'data/txs/zk_tx_3.tx',
    'data/txs/zk_tx_4.tx',
  ]
  return prebuiltTxs.map(path => ZkTx.decode(fs.readFileSync(path)))
}

export async function buildAndSaveZkTxs(): Promise<void> {
  const treePath = 'build/tree1'
  // reset data
  fs.removeSync(treePath)
  fs.mkdirSync(treePath)
  const rocksdb = new RocksDB(treePath)
  const db = await nSQL().createDatabase({
    id: 'test-database',
    mode: rocksdb,
    tables: [], // TODO make the core package handle this
  })
  const { grove } = await loadGrove(db)
  const aliceZkWizard = new ZkWizard({
    db,
    grove,
    privKey: alicePrivKey,
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
  } = loadCircuits()
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
  const zk_tx_1 = await aliceZkWizard.shield({ tx: tx_1 })
  const zk_tx_2_1 = await aliceZkWizard.shield({ tx: tx_2_1 })
  const zk_tx_2_2 = await bobZkWizard.shield({ tx: tx_2_2 })
  const zk_tx_3 = await aliceZkWizard.shield({ tx: tx_3 })
  const zk_tx_4 = await aliceZkWizard.shield({ tx: tx_4 })
  fs.writeFileSync('data/txs/zk_tx_1.tx', zk_tx_1.encode())
  fs.writeFileSync('data/txs/zk_tx_2_1.tx', zk_tx_2_1.encode())
  fs.writeFileSync('data/txs/zk_tx_2_2.tx', zk_tx_2_2.encode())
  fs.writeFileSync('data/txs/zk_tx_3.tx', zk_tx_3.encode())
  fs.writeFileSync('data/txs/zk_tx_4.tx', zk_tx_4.encode())
}
