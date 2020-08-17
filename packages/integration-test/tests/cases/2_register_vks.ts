/* eslint-disable jest/no-standalone-expect */
/* eslint-disable jest/require-tothrow-message */
/* eslint-disable jest/no-export */
/* eslint-disable jest/require-top-level-describe */

import { Provider } from './context'

export const testRegisterVKs = (ctx: Provider) => async () => {
  const { contract, vks, accounts } = ctx()
  const nIn = Object.keys(vks)
  const nOut = Object.keys(vks[1])
  const registerVKs: (() => Promise<void>)[] = []
  let registeredNum = 0
  nIn.forEach(i => {
    nOut.forEach(j => {
      registerVKs.push(async () => {
        const tx = contract.setup.methods.registerVk(
          i,
          j,
          vks[i][j].vk_alfa_1.slice(0, 2),
          vks[i][j].vk_beta_2.slice(0, 2),
          vks[i][j].vk_gamma_2.slice(0, 2),
          vks[i][j].vk_delta_2.slice(0, 2),
          vks[i][j].IC.map((arr: string[][]) => arr.slice(0, 2)),
        )
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

export const testRegisterVKFails = (ctx: Provider) => async () => {
  const { contract, vks, accounts } = ctx()
  const sampleVk = vks[4][4]
  const tx = contract.setup.methods.registerVk(
    5,
    5,
    sampleVk.vk_alfa_1.slice(0, 2),
    sampleVk.vk_beta_2.slice(0, 2),
    sampleVk.vk_gamma_2.slice(0, 2),
    sampleVk.vk_delta_2.slice(0, 2),
    sampleVk.IC.map((arr: string[][]) => arr.slice(0, 2)),
  )
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
