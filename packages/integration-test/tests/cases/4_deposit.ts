/* eslint-disable jest/no-expect-resolves */
/* eslint-disable jest/require-tothrow-message */
/* eslint-disable jest/no-export */
/* eslint-disable jest/require-top-level-describe */

import { toWei } from 'web3-utils'
import { CtxProvider } from './context'

export const depositEther = (ctx: CtxProvider) => async () => {
  const { wallets } = ctx()
  await expect(
    wallets.alice.depositEther(toWei('10', 'ether'), toWei('100000', 'gwei')),
  ).resolves.toStrictEqual(true)
  await expect(
    wallets.bob.depositEther(toWei('10', 'ether'), toWei('100000', 'gwei')),
  ).resolves.toStrictEqual(true)
  await expect(
    wallets.carl.depositEther(toWei('10', 'ether'), toWei('100000', 'gwei')),
  ).resolves.toStrictEqual(true)
}

export const depositERC20 = (ctx: CtxProvider) => async () => {
  const { accounts, contract } = ctx()
  const tx = contract.setup.methods.completeSetup()
  await expect(
    tx.estimateGas({ from: accounts.alice.ethAddress }),
  ).rejects.toThrow()
  await expect(
    tx.estimateGas({ from: accounts.bob.ethAddress }),
  ).rejects.toThrow()
  await expect(
    tx.estimateGas({ from: accounts.carl.ethAddress }),
  ).rejects.toThrow()
  await expect(
    tx.estimateGas({ from: accounts.coordinator.ethAddress }),
  ).rejects.toThrow()
}

export const depositERC721 = (ctx: CtxProvider) => async () => {
  const { accounts, contract } = ctx()
  const tx = contract.setup.methods.completeSetup()
  await expect(
    tx.estimateGas({ from: accounts.alice.ethAddress }),
  ).rejects.toThrow()
  await expect(
    tx.estimateGas({ from: accounts.bob.ethAddress }),
  ).rejects.toThrow()
  await expect(
    tx.estimateGas({ from: accounts.carl.ethAddress }),
  ).rejects.toThrow()
  await expect(
    tx.estimateGas({ from: accounts.coordinator.ethAddress }),
  ).rejects.toThrow()
}
