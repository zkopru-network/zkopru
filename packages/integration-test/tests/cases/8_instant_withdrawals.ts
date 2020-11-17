/* eslint-disable jest/no-truthy-falsy */
/* eslint-disable jest/no-expect-resolves */
/* eslint-disable jest/require-tothrow-message */
/* eslint-disable jest/no-export */
/* eslint-disable jest/require-top-level-describe */

import { WithdrawalStatus } from '@zkopru/transaction'
import { CtxProvider } from './context'

export const testGetWithdrawablesOfAlice = (ctx: CtxProvider) => async () => {
  const { wallets, accounts } = ctx()
  const { alice } = wallets
  const unfinalizedWithdrawables = await alice.getWithdrawables(
    accounts.alice,
    WithdrawalStatus.WITHDRAWABLE,
  )
  expect(unfinalizedWithdrawables).toHaveLength(1)
}
// export const payForEthWithdrawalInAdvance = (ctx: CtxProvider) => async () => {
//   const { wallets, tokens, accounts } = ctx()
//   const tokenAddr = tokens.erc721.address
//   const coordinatorWallet = wallets.coordinator
//   const { coordinator } = accounts

//   const alicePrevBalance = await aliceWallet.getSpendableAmount(alice)
//   const aliceSpendables: Utxo[] = await aliceWallet.getSpendables(alice)
//   const alicePrevNFTs = alicePrevBalance.getNFTs(tokenAddr)
//   const aliceRawTx = TxBuilder.from(alice.zkAddress)
//     .provide(...aliceSpendables.map(note => Utxo.from(note)))
//     .weiPerByte(toWei('100000', 'gwei'))
//     .sendNFT({
//       eth: Field.zero,
//       tokenAddr,
//       nft: alicePrevNFTs[0],
//       to: ZkAddress.null,
//       withdrawal: {
//         to: Field.from(alice.ethAddress),
//         fee: Field.zero, // NFT is not allowed for instant withdrawal
//       },
//     })
//     .build()
//   const aliceZkTx = await aliceWallet.shieldTx({
//     tx: aliceRawTx,
//   })
//   const aliceNewNFTs = (await aliceWallet.getSpendableAmount(alice)).getNFTs(
//     tokenAddr,
//   )
//   const aliceLockedNFTs = (await aliceWallet.getLockedAmount(alice)).getNFTs(
//     tokenAddr,
//   )
//   expect(
//     [...aliceLockedNFTs, ...aliceNewNFTs].map(f => f.toString()).sort(),
//   ).toStrictEqual(alicePrevNFTs.map(f => f.toString()).sort())
//   return aliceZkTx
// }
