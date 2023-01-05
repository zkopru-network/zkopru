import chai from 'chai'

import { BigNumber, BigNumberish } from 'ethers'
import { CtxProvider } from '../context'

const { expect } = chai
type Point = [BigNumberish, BigNumberish]
export const testRegisterVKs = (ctx: CtxProvider) => async () => {
  const { contract, vks, accounts } = ctx()
  const nIn = Object.keys(vks)
  const nOut = Object.keys(vks[1])
  let registeredNum = 0
  for (const i of nIn) {
    for (const j of nOut) {
      const vk = vks[i][j]
      const tx = await contract.setup
        .connect(accounts.coordinator.ethAccount!)
        .registerVk(i, j, {
          alpha1: {
            X: BigNumber.from(vk.vk_alpha_1[0]),
            Y: BigNumber.from(vk.vk_alpha_1[1]),
          },
          beta2: {
            X: vk.vk_beta_2[0].reverse().map(v => BigNumber.from(v)) as Point,
            Y: vk.vk_beta_2[1].reverse().map(v => BigNumber.from(v)) as Point,
          },
          gamma2: {
            X: vk.vk_gamma_2[0].reverse().map(v => BigNumber.from(v)) as Point,
            Y: vk.vk_gamma_2[1].reverse().map(v => BigNumber.from(v)) as Point,
          },
          delta2: {
            X: vk.vk_delta_2[0].reverse().map(v => BigNumber.from(v)) as Point,
            Y: vk.vk_delta_2[1].reverse().map(v => BigNumber.from(v)) as Point,
          },
          ic: vk.IC.map((ic: BigInt[]) => ({
            X: BigNumber.from(ic[0]),
            Y: BigNumber.from(ic[1]),
          })),
        })
      await tx.wait()
      registeredNum += 1
    }
  }
  expect(registeredNum).to.eq(16)
}

export const testRegisterVKFails = (ctx: CtxProvider) => async () => {
  const { contract, vks, accounts } = ctx()
  const sampleVk: any = vks[3][3]
  const tx = await contract.setup.populateTransaction.registerVk(
    5,
    5,

    {
      alpha1: {
        X: sampleVk.vk_alpha_1[0],
        Y: sampleVk.vk_alpha_1[1],
      },
      beta2: {
        X: sampleVk.vk_beta_2[0].reverse() as Point,
        Y: sampleVk.vk_beta_2[1].reverse() as Point,
      },
      gamma2: {
        X: sampleVk.vk_gamma_2[0].reverse() as Point,
        Y: sampleVk.vk_gamma_2[1].reverse() as Point,
      },
      delta2: {
        X: sampleVk.vk_delta_2[0].reverse() as Point,
        Y: sampleVk.vk_delta_2[1].reverse() as Point,
      },
      ic: sampleVk.IC.map((ic: string[]) => ({ X: ic[0], Y: ic[1] })),
    },
  )
  await expect(accounts.alice.ethAccount!.sendTransaction(tx)).to.be.reverted
  await expect(accounts.bob.ethAccount!.sendTransaction(tx)).to.be.reverted
  await expect(accounts.carl.ethAccount!.sendTransaction(tx)).to.be.reverted
}
