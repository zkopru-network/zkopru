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
        const tx = contract.setup.methods.registerVk(i, j, [
          [vk.vk_alpha_1[0], vk.vk_alpha_1[1]],
          [vk.vk_beta_2[0].reverse(), vk.vk_beta_2[1].reverse()],
          [vk.vk_gamma_2[0].reverse(), vk.vk_gamma_2[1].reverse()],
          [vk.vk_delta_2[0].reverse(), vk.vk_delta_2[1].reverse()],
          vk.IC.map((ic: string[][]) => [ic[0], ic[1]]),
        ])
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
  const tx = contract.setup.methods.registerVk(5, 5, [
    [sampleVk.vk_alpha_1[0], sampleVk.vk_alpha_1[1]],
    [sampleVk.vk_beta_2[0].reverse(), sampleVk.vk_beta_2[1].reverse()],
    [sampleVk.vk_gamma_2[0].reverse(), sampleVk.vk_gamma_2[1].reverse()],
    [sampleVk.vk_delta_2[0].reverse(), sampleVk.vk_delta_2[1].reverse()],
    sampleVk.IC.map((ic: string[][]) => [ic[0], ic[1]]),
  ])
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
