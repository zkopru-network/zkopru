/* eslint-disable @typescript-eslint/camelcase */
import { Fp } from '@zkopru/babyjubjub'
import { TokenUtils, Utxo, Withdrawal } from '@zkopru/transaction'
import { accounts, address, nfts } from './testset-predefined'

const utxo1_in_1: Utxo = Utxo.newEtherNote({
  owner: accounts.alice.zkAddress,
  salt: 11,
  eth: 3333,
})
const utxo1_out_1: Utxo = Utxo.newEtherNote({
  owner: accounts.bob.zkAddress,
  salt: 12,
  eth: 2221,
})
const utxo1_out_2: Utxo = Utxo.newEtherNote({
  owner: accounts.alice.zkAddress,
  salt: 13,
  eth: 1111,
})
const utxo1_out_2_false: Utxo = Utxo.newERC20Note({
  owner: accounts.alice.zkAddress,
  salt: 13,
  eth: 1111,
  tokenAddr: TokenUtils.DAI,
  erc20Amount: 8888,
})
const utxo2_1_in_1: Utxo = Utxo.newERC20Note({
  owner: accounts.alice.zkAddress,
  salt: 14,
  eth: 22222333333,
  tokenAddr: TokenUtils.DAI,
  erc20Amount: 8888,
})
const utxo2_1_out_1: Utxo = Utxo.newERC20Note({
  owner: accounts.alice.zkAddress,
  salt: 15,
  eth: 22222333332,
  tokenAddr: TokenUtils.DAI,
  erc20Amount: 5555,
})
const utxo2_1_out_2: Utxo = Utxo.newERC20Note({
  owner: accounts.bob.zkAddress,
  salt: 16,
  eth: 0,
  tokenAddr: TokenUtils.DAI,
  erc20Amount: 3333,
})

const utxo2_2_in_1: Utxo = Utxo.newNFTNote({
  owner: accounts.bob.zkAddress,
  salt: 17,
  eth: 7777777777,
  tokenAddr: TokenUtils.CRYPTO_KITTIES,
  nft: nfts.KITTY_1,
})
const utxo2_2_out_1: Utxo = Utxo.newEtherNote({
  owner: accounts.bob.zkAddress,
  salt: 18,
  eth: 7777777776,
})
const utxo2_2_out_2: Utxo = Utxo.newNFTNote({
  owner: accounts.alice.zkAddress,
  salt: 19,
  eth: 0,
  tokenAddr: TokenUtils.CRYPTO_KITTIES,
  nft: nfts.KITTY_1,
})

const utxo3_in_1: Utxo = Utxo.newEtherNote({
  owner: accounts.alice.zkAddress,
  salt: 21,
  eth: 111111111111111,
})
const utxo3_in_2: Utxo = Utxo.newEtherNote({
  owner: accounts.alice.zkAddress,
  salt: 22,
  eth: 222222222222222,
})
const utxo3_in_3: Utxo = Utxo.newEtherNote({
  owner: accounts.alice.zkAddress,
  salt: 23,
  eth: 333333333333333,
})
const withdrawal3_out_1: Withdrawal = Utxo.newEtherNote({
  eth: 666666666666664,
  owner: accounts.alice.zkAddress,
  salt: 24,
}).toWithdrawal({ to: Fp.from(address.USER_A), fee: Fp.from(1) })

const utxo4_in_1: Utxo = Utxo.newEtherNote({
  owner: accounts.alice.zkAddress,
  salt: 25,
  eth: 8888888888888,
})
const utxo4_in_2: Utxo = Utxo.newERC20Note({
  owner: accounts.alice.zkAddress,
  salt: 26,
  eth: 0,
  tokenAddr: TokenUtils.DAI,
  erc20Amount: 5555,
})
const utxo4_in_3: Utxo = Utxo.newNFTNote({
  owner: accounts.alice.zkAddress,
  salt: 27,
  eth: 0,
  tokenAddr: TokenUtils.CRYPTO_KITTIES,
  nft: nfts.KITTY_2,
})
const migration_4_1 = Utxo.newEtherNote({
  owner: accounts.alice.zkAddress,
  salt: 28,
  eth: 8888888888884,
}).toMigration({
  to: Fp.from(address.CONTRACT_B),
  fee: Fp.from(1), // fee for tx & fee for withdrawal for each utxos
})
const migration_4_2 = Utxo.newERC20Note({
  owner: accounts.alice.zkAddress,
  salt: 29,
  eth: 0,
  tokenAddr: TokenUtils.DAI,
  erc20Amount: 5555,
}).toMigration({
  to: Fp.from(address.CONTRACT_B),
  fee: Fp.from(1),
})
const migration_4_3 = Utxo.newNFTNote({
  owner: accounts.alice.zkAddress,
  salt: 30,
  eth: 0,
  tokenAddr: TokenUtils.CRYPTO_KITTIES,
  nft: nfts.KITTY_2,
}).toMigration({
  to: Fp.from(address.CONTRACT_B),
  fee: Fp.from(1),
})

// testing size of transactions
// inflow = outflow + fee
const utxo5_1_in_1: Utxo = Utxo.newEtherNote({
  owner: accounts.alice.zkAddress,
  salt: 31,
  eth: 10,
})
const utxo5_1_out_1: Utxo = Utxo.newEtherNote({
  owner: accounts.bob.zkAddress,
  salt: 32,
  eth: 9,
})

const utxo5_2_in_1: Utxo = Utxo.newEtherNote({
  owner: accounts.alice.zkAddress,
  salt: 33,
  eth: 10,
})

const utxo5_2_out_1: Utxo = Utxo.newEtherNote({
  owner: accounts.bob.zkAddress,
  salt: 34,
  eth: 5,
})

const utxo5_2_out_2: Utxo = Utxo.newEtherNote({
  owner: accounts.alice.zkAddress,
  salt: 35,
  eth: 4,
})

const utxo5_3_in_1: Utxo = Utxo.newERC20Note({
  owner: accounts.alice.zkAddress,
  salt: 36,
  eth: 22222333333,
  tokenAddr: TokenUtils.DAI,
  erc20Amount: 8888,
})
const utxo5_3_out_1: Utxo = Utxo.newERC20Note({
  owner: accounts.alice.zkAddress,
  salt: 37,
  eth: 22222333332,
  tokenAddr: TokenUtils.DAI,
  erc20Amount: 5555,
})
const utxo5_3_out_2: Utxo = Utxo.newERC20Note({
  owner: accounts.bob.zkAddress,
  salt: 38,
  eth: 0,
  tokenAddr: TokenUtils.DAI,
  erc20Amount: 3333,
})

export const utxos = {
  utxo1_in_1,
  utxo1_out_1,
  utxo1_out_2,
  utxo1_out_2_false,
  utxo2_1_in_1,
  utxo2_1_out_1,
  utxo2_1_out_2,
  utxo2_2_in_1,
  utxo2_2_out_1,
  utxo2_2_out_2,
  utxo3_in_1,
  utxo3_in_2,
  utxo3_in_3,
  withdrawal3_out_1,
  utxo4_in_1,
  utxo4_in_2,
  utxo4_in_3,
  migration_4_1,
  migration_4_2,
  migration_4_3,
  utxo5_1_in_1,
  utxo5_1_out_1,
  utxo5_2_in_1,
  utxo5_2_out_1,
  utxo5_2_out_2,
  utxo5_3_in_1,
  utxo5_3_out_1,
  utxo5_3_out_2,
}
