/* eslint-disable jest/no-truthy-falsy */
/* eslint-disable jest/no-expect-resolves */
/* eslint-disable jest/require-tothrow-message */
/* eslint-disable jest/no-export */
/* eslint-disable jest/require-top-level-describe */

import { toWei } from 'web3-utils'
import { TxBuilder, Utxo } from '@zkopru/transaction'
import { Field } from '@zkopru/babyjubjub'
import { CtxProvider } from './context'

export const testAliceSendEtherToBob = (ctx: CtxProvider) => async () => {
  const { wallets, accounts } = ctx()
  const wallet = wallets.alice
  const { alice } = accounts
  const { bob } = accounts
  const prevSpendable = await wallet.getSpendableAmount(alice)
  const spendables: Utxo[] = await wallet.getSpendables(alice)
  const tx = TxBuilder.from(alice.zkAddress)
    .provide(...spendables.map(note => Utxo.from(note)))
    .weiPerByte(toWei('10000', 'gwei'))
    .sendEther({
      eth: Field.from(toWei('1', 'ether')),
      to: bob.zkAddress,
    })
    .build()
  const response = await wallet.sendTx(tx)
  const newSpendable = await wallet.getSpendableAmount(alice)
  const lockedAmount = await wallet.getLockedAmount(alice)
  expect(response.status).toStrictEqual(200)
  expect(newSpendable.eth.add(lockedAmount.eth)).toBe(prevSpendable.eth)
}

export const testBobSendERC20ToCarl = (ctx: CtxProvider) => async () => {
  const { wallets, accounts, tokens } = ctx()
  const wallet = wallets.bob
  const { bob } = accounts
  const { carl } = accounts
  const tokenAddr = tokens.erc20.address
  const prevSpendable = (await wallet.getSpendableAmount(bob)).getERC20(
    tokenAddr,
  )
  const spendables: Utxo[] = await wallet.getSpendables(bob)
  const tx = TxBuilder.from(bob.zkAddress)
    .provide(...spendables.map(note => Utxo.from(note)))
    .weiPerByte(toWei('10000', 'gwei'))
    .sendERC20({
      eth: Field.zero,
      tokenAddr,
      erc20Amount: Field.from(toWei('1', 'ether')),
      to: carl.zkAddress,
    })
    .build()
  const response = await wallet.sendTx(tx)
  const newSpendable = (await wallet.getSpendableAmount(bob)).getERC20(
    tokenAddr,
  )
  const lockedAmount = (await wallet.getLockedAmount(bob)).getERC20(tokenAddr)
  expect(response.status).toStrictEqual(200)
  expect(newSpendable.add(lockedAmount)).toBe(prevSpendable)
}

export const testCarlSendNFTtoAlice = (ctx: CtxProvider) => async () => {
  const { wallets, accounts, tokens } = ctx()
  const wallet = wallets.carl
  const { carl } = accounts
  const { alice } = accounts
  const tokenAddr = tokens.erc721.address
  const prevSpendableAmount = await wallet.getSpendableAmount(carl)
  const prevSpendableNFTs = prevSpendableAmount.getNFTs(tokenAddr)
  const spendables: Utxo[] = await wallet.getSpendables(carl)
  const tx = TxBuilder.from(carl.zkAddress)
    .provide(...spendables.map(note => Utxo.from(note)))
    .weiPerByte(toWei('10000', 'gwei'))
    .sendNFT({
      eth: Field.zero,
      tokenAddr,
      nft: prevSpendableNFTs[0],
      to: alice.zkAddress,
    })
    .build()
  const response = await wallet.sendTx(tx)
  const newSpendableNFTs = (await wallet.getSpendableAmount(carl)).getNFTs(
    tokenAddr,
  )
  const lockedNFTs = (await wallet.getLockedAmount(carl)).getNFTs(tokenAddr)
  expect(response.status).toStrictEqual(200)
  expect(
    [...lockedNFTs, ...newSpendableNFTs].map(f => f.toString()).sort(),
  ).toStrictEqual(prevSpendableNFTs.map(f => f.toString()).sort())
}
