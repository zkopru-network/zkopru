/* eslint-disable jest/no-expect-resolves */
/* eslint-disable jest/require-tothrow-message */
/* eslint-disable jest/no-export */
/* eslint-disable jest/require-top-level-describe */

import { sleep } from '@zkopru/utils'
import { CtxProvider } from './context'

export const waitCoordinatorToProposeANewBlock = (
  ctx: CtxProvider,
) => async () => {
  const { contract } = ctx()
  let msToWait = 18000
  let proposedBlocks!: string
  while (msToWait > 0) {
    proposedBlocks = await contract.upstream.methods.proposedBlocks().call()
    if (proposedBlocks === '2') break
    msToWait -= 1000
    await sleep(1000)
  }
  expect(proposedBlocks).toStrictEqual('2')
}

// TODO Fix that processed block does not count the genesis block (proposed: 2 / processed: 1)
export const waitCoordinatorToProcessTheNewBlock = (
  ctx: CtxProvider,
) => async () => {
  const { coordinator } = ctx()
  let msToWait = 25000
  let processedBlocks!: number
  while (msToWait > 0) {
    processedBlocks = coordinator.node.latestProcessed || 0
    if (processedBlocks === 1) break
    msToWait -= 1000
    await sleep(1000)
  }
  expect(processedBlocks).toStrictEqual(1)
}

export const testBlockSync = (ctx: CtxProvider) => async () => {
  const { wallets } = ctx()
  let msToWait = 5000
  while (msToWait > 0) {
    if (
      wallets.alice.node.latestProcessed === 1 &&
      wallets.bob.node.latestProcessed === 1 &&
      wallets.carl.node.latestProcessed === 1
    )
      break
    msToWait -= 1000
    await sleep(1000)
  }
  expect(wallets.alice.node.latestProcessed).toStrictEqual(1)
  expect(wallets.bob.node.latestProcessed).toStrictEqual(1)
  expect(wallets.carl.node.latestProcessed).toStrictEqual(1)
}
