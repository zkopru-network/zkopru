/* eslint-disable @typescript-eslint/camelcase */
import { Field } from '@zkopru/babyjubjub'
import { TokenUtils, Utxo, Withdrawal } from '@zkopru/transaction'
import { accounts, address, nfts } from './testset-keys'

const utxo1_in_1: Utxo = Utxo.newEtherNote({
  eth: 3333,
  pubKey: accounts.alice.pubKey,
  salt: 11,
})
const utxo1_out_1: Utxo = Utxo.newEtherNote({
  eth: 2221,
  pubKey: accounts.bob.pubKey,
  salt: 12,
})
const utxo1_out_2: Utxo = Utxo.newEtherNote({
  eth: 1111,
  pubKey: accounts.alice.pubKey,
  salt: 13,
})
const utxo2_1_in_1: Utxo = Utxo.newERC20Note({
  eth: 22222333333,
  tokenAddr: TokenUtils.DAI,
  erc20Amount: 8888,
  pubKey: accounts.alice.pubKey,
  salt: 14,
})
const utxo2_1_out_1: Utxo = Utxo.newERC20Note({
  eth: 22222333332,
  tokenAddr: TokenUtils.DAI,
  erc20Amount: 5555,
  pubKey: accounts.alice.pubKey,
  salt: 15,
})
const utxo2_1_out_2: Utxo = Utxo.newERC20Note({
  eth: 0,
  tokenAddr: TokenUtils.DAI,
  erc20Amount: 3333,
  pubKey: accounts.bob.pubKey,
  salt: 16,
})

const utxo2_2_in_1: Utxo = Utxo.newNFTNote({
  eth: 7777777777,
  tokenAddr: TokenUtils.CRYPTO_KITTIES,
  nft: nfts.KITTY_1,
  pubKey: accounts.bob.pubKey,
  salt: 17,
})
const utxo2_2_out_1: Utxo = Utxo.newEtherNote({
  eth: 7777777776,
  pubKey: accounts.bob.pubKey,
  salt: 18,
})
const utxo2_2_out_2: Utxo = Utxo.newNFTNote({
  eth: 0,
  tokenAddr: TokenUtils.CRYPTO_KITTIES,
  nft: nfts.KITTY_1,
  pubKey: accounts.alice.pubKey,
  salt: 19,
})

const utxo3_in_1: Utxo = Utxo.newEtherNote({
  eth: 111111111111111,
  pubKey: accounts.alice.pubKey,
  salt: 21,
})
const utxo3_in_2: Utxo = Utxo.newEtherNote({
  eth: 222222222222222,
  pubKey: accounts.alice.pubKey,
  salt: 22,
})
const utxo3_in_3: Utxo = Utxo.newEtherNote({
  eth: 333333333333333,
  pubKey: accounts.alice.pubKey,
  salt: 23,
})
const withdrawal3_out_1: Withdrawal = Utxo.newEtherNote({
  eth: 666666666666664,
  pubKey: accounts.alice.pubKey,
  salt: 24,
}).toWithdrawal({ to: Field.from(address.USER_A), fee: Field.from(1) })

const utxo4_in_1: Utxo = Utxo.newEtherNote({
  eth: 8888888888888,
  pubKey: accounts.alice.pubKey,
  salt: 25,
})
const utxo4_in_2: Utxo = Utxo.newERC20Note({
  eth: 0,
  tokenAddr: TokenUtils.DAI,
  erc20Amount: 5555,
  pubKey: accounts.alice.pubKey,
  salt: 26,
})
const utxo4_in_3: Utxo = Utxo.newNFTNote({
  eth: 0,
  tokenAddr: TokenUtils.CRYPTO_KITTIES,
  nft: nfts.KITTY_2,
  pubKey: accounts.alice.pubKey,
  salt: 27,
})
const migration_4_1 = Utxo.newEtherNote({
  eth: 8888888888884,
  pubKey: accounts.alice.pubKey,
  salt: 28,
}).toMigration({
  to: Field.from(address.CONTRACT_B),
  fee: Field.from(1), // fee for tx & fee for withdrawal for each utxos
})
const migration_4_2 = Utxo.newERC20Note({
  eth: 0,
  tokenAddr: TokenUtils.DAI,
  erc20Amount: 5555,
  pubKey: accounts.alice.pubKey,
  salt: 29,
}).toMigration({
  to: Field.from(address.CONTRACT_B),
  fee: Field.from(1),
})
const migration_4_3 = Utxo.newNFTNote({
  eth: 0,
  tokenAddr: TokenUtils.CRYPTO_KITTIES,
  nft: nfts.KITTY_2,
  pubKey: accounts.alice.pubKey,
  salt: 30,
}).toMigration({
  to: Field.from(address.CONTRACT_B),
  fee: Field.from(1),
})

export const utxos = {
  utxo1_in_1,
  utxo1_out_1,
  utxo1_out_2,
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
}
