/* eslint-disable jest/no-export */
/* eslint-disable jest/no-hooks */
/* eslint-disable jest/require-top-level-describe */

import { toWei } from 'web3-utils'
import { CtxProvider } from './context'

export const testAliceAccount = (ctx: CtxProvider) => async () => {
  const { web3, accounts } = ctx()
  expect(
    await web3.eth.getBalance(accounts.alice.ethAccount.address),
  ).toStrictEqual(toWei('100'))
}
export const testBobAccount = (ctx: CtxProvider) => async () => {
  const { web3, accounts } = ctx()
  expect(
    await web3.eth.getBalance(accounts.bob.ethAccount.address),
  ).toStrictEqual(toWei('100'))
}

export const testCarlAccount = (ctx: CtxProvider) => async () => {
  const { web3, accounts } = ctx()
  expect(
    await web3.eth.getBalance(accounts.carl.ethAccount.address),
  ).toStrictEqual(toWei('100'))
}
