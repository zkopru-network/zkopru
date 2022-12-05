/* eslint-disable jest/no-expect-resolves */
/* eslint-disable jest/require-tothrow-message */
/* eslint-disable jest/no-export */
/* eslint-disable jest/require-top-level-describe */
import { expect } from 'chai'
import { sleep } from '~utils'
import { BigNumber } from 'ethers'
import { parseEther } from 'ethers/lib/utils'
import { IBurnAuction__factory } from '~contracts'
import { CtxProvider } from '../context'

export const registerCoordinator = (ctx: CtxProvider) => async () => {
  const { accounts, contract, provider } = ctx()
  const consensusAddress = await contract.zkopru.consensusProvider()
  await IBurnAuction__factory.connect(consensusAddress, provider)
    .connect(accounts.coordinator.ethAccount!)
    .register({ value: parseEther('32') })
}

export const waitCoordinatorToProposeANewBlock = (
  ctx: CtxProvider,
) => async () => {
  const { contract, fixtureProvider } = ctx()
  let msToWait = 60000
  let proposedBlocks!: BigNumber
  while (msToWait > 0) {
    proposedBlocks = await contract.zkopru.proposedBlocks()
    if (proposedBlocks.eq(2)) break
    await fixtureProvider.advanceBlock(8)
    msToWait -= 1000
    await sleep(1000)
  }
  expect(proposedBlocks).to.eq(2)
}

// TODO Fix that processed block does not count the genesis block (proposed: 2 / processed: 1)
export const waitCoordinatorToProcessTheNewBlock = (
  ctx: CtxProvider,
) => async () => {
  const { coordinator, fixtureProvider } = ctx()
  let msToWait = 60000
  let processedBlocks!: number
  while (msToWait > 0) {
    processedBlocks = coordinator.node().synchronizer.latestProcessed || 0
    if (processedBlocks === 1) break
    await fixtureProvider.advanceBlock(8)
    msToWait -= 1000
    await sleep(1000)
  }
  expect(processedBlocks).to.eq(1)
}

export const testBlockSync = (ctx: CtxProvider) => async () => {
  const { wallets, fixtureProvider } = ctx()
  let msToWait = 60000
  while (msToWait > 0) {
    if (
      wallets.alice.node.synchronizer.latestProcessed === 1 &&
      wallets.bob.node.synchronizer.latestProcessed === 1 &&
      wallets.carl.node.synchronizer.latestProcessed === 1
    )
      break
    msToWait -= 1000
    await fixtureProvider.advanceBlock(8)
    await sleep(1000)
  }
  expect(wallets.alice.node.synchronizer.latestProcessed).to.eq(1)
  expect(wallets.bob.node.synchronizer.latestProcessed).to.eq(1)
  expect(wallets.carl.node.synchronizer.latestProcessed).to.eq(1)
}
