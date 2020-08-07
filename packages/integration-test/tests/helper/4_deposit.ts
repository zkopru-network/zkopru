/* eslint-disable jest/no-expect-resolves */
/* eslint-disable jest/require-tothrow-message */
/* eslint-disable jest/no-export */
/* eslint-disable jest/require-top-level-describe */

import { Provider } from './context'

export const depositEther = (ctx: Provider) => async () => {
  const { accounts, contract } = ctx()
  const tx = contract.setup.methods.completeSetup()
  const gas = await tx.estimateGas()
  await expect(tx.send({ from: accounts.alice.ethAddress, gas })).rejects.toThrow()
  await expect(tx.send({ from: accounts.bob.ethAddress, gas })).rejects.toThrow()
  await expect(tx.send({ from: accounts.carl.ethAddress, gas })).rejects.toThrow()
  await expect(
    tx.send({ from: accounts.coordinator.ethAddress, gas }),
  ).resolves.toHaveProperty('transactionHash')
}

export const depositERC20 = (ctx: Provider) => async () => {
  const { accounts, contract } = ctx()
  const tx = contract.setup.methods.completeSetup()
  await expect(
    tx.estimateGas({ from: accounts.alice.ethAddress }),
  ).rejects.toThrow()
  await expect(tx.estimateGas({ from: accounts.bob.ethAddress })).rejects.toThrow()
  await expect(
    tx.estimateGas({ from: accounts.carl.ethAddress }),
  ).rejects.toThrow()
  await expect(
    tx.estimateGas({ from: accounts.coordinator.ethAddress }),
  ).rejects.toThrow()
}

export const depositERC721 = (ctx: Provider) => async () => {
  const { accounts, contract } = ctx()
  const tx = contract.setup.methods.completeSetup()
  await expect(
    tx.estimateGas({ from: accounts.alice.ethAddress }),
  ).rejects.toThrow()
  await expect(tx.estimateGas({ from: accounts.bob.ethAddress })).rejects.toThrow()
  await expect(
    tx.estimateGas({ from: accounts.carl.ethAddress }),
  ).rejects.toThrow()
  await expect(
    tx.estimateGas({ from: accounts.coordinator.ethAddress }),
  ).rejects.toThrow()
}
