/* eslint-disable jest/no-expect-resolves */
/* eslint-disable jest/require-tothrow-message */
/* eslint-disable jest/no-export */
/* eslint-disable jest/require-top-level-describe */

import { toWei } from 'web3-utils'
import { verifyingKeyIdentifier } from '@zkopru/utils'
import { CtxProvider } from './context'

export const testCompleteSetup = (ctx: CtxProvider) => async () => {
  const { accounts, contract } = ctx()
  const tx = contract.setup.methods.completeSetup()
  const gas = await tx.estimateGas()
  await expect(
    tx.send({ from: accounts.alice.ethAddress, gas }),
  ).rejects.toThrow()
  await expect(
    tx.send({ from: accounts.bob.ethAddress, gas }),
  ).rejects.toThrow()
  await expect(
    tx.send({ from: accounts.carl.ethAddress, gas }),
  ).rejects.toThrow()
  await expect(
    tx.send({ from: accounts.coordinator.ethAddress, gas }),
  ).resolves.toHaveProperty('transactionHash')
}

export const testRejectVkRegistration = (ctx: CtxProvider) => async () => {
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

export const registerCoordinator = (ctx: CtxProvider) => async () => {
  const { wallets, contract, zkopruAddress } = ctx()
  await wallets.coordinator.sendLayer1Tx({
    contract: zkopruAddress,
    tx: contract.coordinator.methods.register(),
    option: {
      value: toWei('32', 'ether'),
    },
  })
}

export const updateVerifyingKeys = (ctx: CtxProvider) => async () => {
  const { wallets, contract, coordinator } = ctx()
  const vks = await contract.getVKs()
  const NUM_OF_INPUTS = 4
  const NUM_OF_OUTPUTS = 4
  for (let nI = 1; nI <= NUM_OF_INPUTS; nI += 1) {
    for (let nO = 1; nO <= NUM_OF_OUTPUTS; nO += 1) {
      const sig = verifyingKeyIdentifier(nI, nO)
      wallets.alice.node.verifier.addVerifyingKey(nI, nO, vks[sig])
      wallets.bob.node.verifier.addVerifyingKey(nI, nO, vks[sig])
      wallets.carl.node.verifier.addVerifyingKey(nI, nO, vks[sig])
      wallets.coordinator.node.verifier.addVerifyingKey(nI, nO, vks[sig])
      coordinator.node.verifier.addVerifyingKey(nI, nO, vks[sig])
    }
  }
}
