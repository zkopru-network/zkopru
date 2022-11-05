/* eslint-disable @typescript-eslint/camelcase */
import { Fp } from '@zkopru/babyjubjub'
import { RawTx, TokenUtils, Utxo, ZkAddress } from '@zkopru/transaction'
import { ZkAccount } from '@zkopru/account'

const alicePrivKey = "I am Alice's private key"
const bobPrivKey = "I am Bob's private key"
const aliceAccount = new ZkAccount(
  alicePrivKey,
  '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1',
)
const bobAccount = new ZkAccount(
  bobPrivKey,
  '0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0',
)
const aliceZkAddress: ZkAddress = aliceAccount.zkAddress
const bobZkAddress: ZkAddress = bobAccount.zkAddress

const utxo1_in_1: Utxo = Utxo.newEtherNote({
  eth: 3333,
  owner: aliceZkAddress,
  salt: 11,
})
const utxo1_out_1: Utxo = Utxo.newEtherNote({
  eth: 2221,
  owner: bobZkAddress,
  salt: 12,
})
const utxo1_out_2: Utxo = Utxo.newEtherNote({
  eth: 1111,
  owner: aliceZkAddress,
  salt: 13,
})
const utxo2_1_in_1: Utxo = Utxo.newERC20Note({
  eth: 22222333333,
  tokenAddr: TokenUtils.DAI,
  erc20Amount: 8888,
  owner: aliceZkAddress,
  salt: 14,
})
const utxo2_1_out_1: Utxo = Utxo.newERC20Note({
  eth: 22222333332,
  tokenAddr: TokenUtils.DAI,
  erc20Amount: 5555,
  owner: aliceZkAddress,
  salt: 15,
})
const utxo2_1_out_2: Utxo = Utxo.newERC20Note({
  eth: 0,
  tokenAddr: TokenUtils.DAI,
  erc20Amount: 3333,
  owner: bobZkAddress,
  salt: 16,
})

const KITTY_1 =
  '0x0078917891789178917891789178917891789178917891789178917891789178'
const KITTY_2 =
  '0x0022222222222222222222222222222222222222222222222222222222222222'

/** Ganache pre-defined addresses */
const USER_A = '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1'
const CONTRACT_B = '0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0'

const utxo2_2_in_1: Utxo = Utxo.newNFTNote({
  eth: 7777777777,
  tokenAddr: TokenUtils.CRYPTO_KITTIES,
  nft: KITTY_1,
  owner: bobZkAddress,
  salt: 17,
})
const utxo2_2_out_1: Utxo = Utxo.newEtherNote({
  eth: 7777777776,
  owner: bobZkAddress,
  salt: 18,
})
const utxo2_2_out_2: Utxo = Utxo.newNFTNote({
  eth: 0,
  tokenAddr: TokenUtils.CRYPTO_KITTIES,
  nft: KITTY_1,
  owner: aliceZkAddress,
  salt: 19,
})
const utxo3_in_1: Utxo = Utxo.newEtherNote({
  eth: 111111111111111,
  owner: aliceZkAddress,
  salt: 21,
})
const utxo3_in_2: Utxo = Utxo.newEtherNote({
  eth: 222222222222222,
  owner: aliceZkAddress,
  salt: 22,
})
const utxo3_in_3: Utxo = Utxo.newEtherNote({
  eth: 333333333333333,
  owner: aliceZkAddress,
  salt: 23,
})
const utxo3_out_1: Utxo = Utxo.newEtherNote({
  eth: 666666666666664,
  owner: aliceZkAddress,
  salt: 24,
})

utxo3_out_1.toWithdrawal({ to: Fp.from(USER_A), fee: Fp.from(1) })

const utxo4_in_1: Utxo = Utxo.newEtherNote({
  eth: 8888888888888,
  owner: aliceZkAddress,
  salt: 25,
})
const utxo4_in_2: Utxo = Utxo.newERC20Note({
  eth: 0,
  tokenAddr: TokenUtils.DAI,
  erc20Amount: 5555,
  owner: aliceZkAddress,
  salt: 26,
})
const utxo4_in_3: Utxo = Utxo.newNFTNote({
  eth: 0,
  tokenAddr: TokenUtils.CRYPTO_KITTIES,
  nft: KITTY_2,
  owner: aliceZkAddress,
  salt: 27,
})
const utxo4_out_1: Utxo = Utxo.newEtherNote({
  eth: 8888888888884,
  owner: aliceZkAddress,
  salt: 28,
}) // fee for tx & fee for withdrawal for each utxos
const utxo4_out_2: Utxo = Utxo.newERC20Note({
  eth: 0,
  tokenAddr: TokenUtils.DAI,
  erc20Amount: 5555,
  owner: aliceZkAddress,
  salt: 29,
})
const utxo4_out_3: Utxo = Utxo.newNFTNote({
  eth: 0,
  tokenAddr: TokenUtils.CRYPTO_KITTIES,
  nft: KITTY_2,
  owner: aliceZkAddress,
  salt: 30,
})
const migration_4_1 = utxo4_out_1.toMigration({
  to: Fp.from(CONTRACT_B),
  fee: Fp.from(1),
})
const migration_4_2 = utxo4_out_2.toMigration({
  to: Fp.from(CONTRACT_B),
  fee: Fp.from(1),
})
const migration_4_3 = utxo4_out_3.toMigration({
  to: Fp.from(CONTRACT_B),
  fee: Fp.from(1),
})

const tx_1: RawTx = {
  inflow: [utxo1_in_1],
  outflow: [utxo1_out_1, utxo1_out_2],
  fee: Fp.from(1),
}

const tx_2_1: RawTx = {
  inflow: [utxo2_1_in_1],
  outflow: [utxo2_1_out_1, utxo2_1_out_2],
  swap: utxo2_2_out_2.hash(),
  fee: Fp.from(1),
}

const tx_2_2: RawTx = {
  inflow: [utxo2_2_in_1],
  outflow: [utxo2_2_out_1, utxo2_2_out_2],
  swap: utxo2_1_out_2.hash(),
  fee: Fp.from(1),
}

const tx_3: RawTx = {
  inflow: [utxo3_in_1, utxo3_in_2, utxo3_in_3],
  outflow: [utxo3_out_1],
  fee: Fp.from(1),
}

const tx_4: RawTx = {
  inflow: [utxo4_in_1, utxo4_in_2, utxo4_in_3],
  outflow: [utxo4_out_1, utxo4_out_2, utxo4_out_3],
  fee: Fp.from(1),
}

export const keys = {
  alicePrivKey,
  alicePubKey: aliceZkAddress,
  bobPrivKey,
  bobPubKey: bobZkAddress,
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
  migration_4_1,
  migration_4_2,
  migration_4_3,
}

export const txs = {
  tx_1,
  tx_2_1,
  tx_2_2,
  tx_3,
  tx_4,
}
