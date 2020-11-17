/* eslint-disable jest/no-truthy-falsy */
/* eslint-disable jest/no-expect-resolves */
/* eslint-disable jest/require-tothrow-message */
/* eslint-disable jest/no-export */
/* eslint-disable jest/require-top-level-describe */

// import { WithdrawalStatus } from '@zkopru/transaction'
import { WithdrawalStatus } from '@zkopru/transaction'
import { Address } from 'soltypes'
import { CtxProvider } from './context'

export const testGetWithdrawablesOfAlice = (ctx: CtxProvider) => async () => {
  const { wallets, accounts } = ctx()
  const { alice } = wallets
  expect(
    await alice.getWithdrawables(accounts.alice, WithdrawalStatus.UNFINALIZED),
  ).toHaveLength(1)
}

export const testGetWithdrawablesOfBob = (ctx: CtxProvider) => async () => {
  const { wallets, accounts } = ctx()
  const { bob } = wallets
  expect(
    await bob.getWithdrawables(accounts.bob, WithdrawalStatus.UNFINALIZED),
  ).toHaveLength(1)
}

export const testGetWithdrawablesOfCarl = (ctx: CtxProvider) => async () => {
  const { wallets, accounts } = ctx()
  const { carl } = wallets
  expect(
    await carl.getWithdrawables(accounts.carl, WithdrawalStatus.UNFINALIZED),
  ).toHaveLength(1)
}

export const payForEthWithdrawalInAdvance = (ctx: CtxProvider) => async () => {
  const { wallets, accounts } = ctx()
  const withdrawals = await wallets.bob.getWithdrawables(
    accounts.bob,
    WithdrawalStatus.UNFINALIZED,
  )
  expect(withdrawals).toHaveLength(1)
  const prevBalance = await wallets.bob.fetchLayer1Assets(accounts.bob)
  const ethWithdrawal = withdrawals[0]
  const result = await wallets.bob.instantWithdrawal(
    Address.from(accounts.coordinator.ethAddress),
    ethWithdrawal,
  )
  const nextBalance = await wallets.bob.fetchLayer1Assets(accounts.bob)
  console.log('instant withdrawal', result)
  console.log('prev balance', prevBalance)
  console.log('next balance', nextBalance)
}
