/* eslint-disable jest/no-standalone-expect */
/* eslint-disable jest/require-tothrow-message */
/* eslint-disable jest/no-export */
/* eslint-disable jest/require-top-level-describe */

import { CtxProvider } from './context'

export const testRegisterVKs = (ctx: CtxProvider) => async () => {
  const { contract, vks, accounts } = ctx()
  const nIn = Object.keys(vks)
  const nOut = Object.keys(vks[1])
  const registerVKs: (() => Promise<void>)[] = []
  let registeredNum = 0
  nIn.forEach(i => {
    nOut.forEach(j => {
      registerVKs.push(async () => {
        const vk = vks[i][j]
        const tx = contract.setup.methods.registerVk(i, j, {
          alpha1: { X: vk.vk_alpha_1[0], Y: vk.vk_alpha_1[1] },
          beta2: {
            X: vk.vk_beta_2[0].reverse(),
            Y: vk.vk_beta_2[1].reverse(),
          },
          gamma2: {
            X: vk.vk_gamma_2[0].reverse(),
            Y: vk.vk_gamma_2[1].reverse(),
          },
          delta2: {
            X: vk.vk_delta_2[0].reverse(),
            Y: vk.vk_delta_2[1].reverse(),
          },
          ic: vk.IC.map((ic: string[][]) => ({
            X: ic[0],
            Y: ic[1],
          })),
        })
        const estimatedGas = await tx.estimateGas()
        const receipt = await tx.send({
          from: accounts.coordinator.ethAddress,
          gas: estimatedGas,
        })
        registeredNum += 1
        expect(receipt).toBeDefined()
      })
    })
  })
  await Promise.all(registerVKs.map(f => f()))
  expect(registeredNum).toStrictEqual(16)
}

export const testRegisterVKFails = (ctx: CtxProvider) => async () => {
  const { contract, vks, accounts } = ctx()
  const sampleVk: any = vks[3][3]
  const tx = contract.setup.methods.registerVk(5, 5, {
    alpha1: { X: sampleVk.vk_alpha_1[0], Y: sampleVk.vk_alpha_1[1] },
    beta2: {
      X: sampleVk.vk_beta_2[0].reverse(),
      Y: sampleVk.vk_beta_2[1].reverse(),
    },
    gamma2: {
      X: sampleVk.vk_gamma_2[0].reverse(),
      Y: sampleVk.vk_gamma_2[1].reverse(),
    },
    delta2: {
      X: sampleVk.vk_delta_2[0].reverse(),
      Y: sampleVk.vk_delta_2[1].reverse(),
    },
    ic: sampleVk.IC.map((ic: string[][]) => ({
      X: ic[0],
      Y: ic[1],
    })),
  })
  const estimatedGas = await tx.estimateGas()
  await expect(
    tx.send({ from: accounts.alice.ethAddress, gas: estimatedGas }),
  ).rejects.toThrow()
  await expect(
    tx.send({ from: accounts.bob.ethAddress, gas: estimatedGas }),
  ).rejects.toThrow()
  await expect(
    tx.send({ from: accounts.carl.ethAddress, gas: estimatedGas }),
  ).rejects.toThrow()
}
