/* eslint-disable @typescript-eslint/camelcase */
import { ZkAccount } from '@zkopru/account'
import { TokenUtils } from '@zkopru/transaction'

const alicePrivKey =
  '0x1111111111111111111111111111111111111111111111111111111111111111'
const bobPrivKey =
  '0x2222222222222222222222222222222222222222222222222222222222222222'
const alice = new ZkAccount(
  alicePrivKey,
  '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1',
)
const bob = new ZkAccount(
  bobPrivKey,
  '0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0',
)

const KITTY_1 =
  '0x0078917891789178917891789178917891789178917891789178917891789178'
const KITTY_2 =
  '0x0022222222222222222222222222222222222222222222222222222222222222'

/** Ganache pre-defined addresses */
const USER_A = '0x90F8bf6A479f320ead074411a4B0e7944Ea8c9C1'
const CONTRACT_B = '0xFFcf8FDEE72ac11b5c542428B35EEF5769C409f0'

export const accounts = {
  alice,
  bob,
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
