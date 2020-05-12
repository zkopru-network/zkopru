/* eslint-disable jest/no-expect-resolves */
/* eslint-disable jest/require-tothrow-message */
/* eslint-disable jest/no-export */
/* eslint-disable jest/require-top-level-describe */

import { Provider } from './context'

export const testCompleteSetup = (ctx: Provider) => async () => {
  const { accounts, contract } = ctx()
  const tx = contract.setup.methods.completeSetup()
  const gas = await tx.estimateGas()
  await expect(tx.send({ from: accounts.alice.address, gas })).rejects.toThrow()
  await expect(tx.send({ from: accounts.bob.address, gas })).rejects.toThrow()
  await expect(tx.send({ from: accounts.carl.address, gas })).rejects.toThrow()
  await expect(
    tx.send({ from: accounts.coordinator.address, gas }),
  ).resolves.toHaveProperty('transactionHash')
}

export const testRejectVkRegistration = (ctx: Provider) => async () => {
  const { accounts, contract } = ctx()
  const tx = contract.setup.methods.completeSetup()
  await expect(
    tx.estimateGas({ from: accounts.alice.address }),
  ).rejects.toThrow()
  await expect(tx.estimateGas({ from: accounts.bob.address })).rejects.toThrow()
  await expect(
    tx.estimateGas({ from: accounts.carl.address }),
  ).rejects.toThrow()
  await expect(
    tx.estimateGas({ from: accounts.coordinator.address }),
  ).rejects.toThrow()
}
