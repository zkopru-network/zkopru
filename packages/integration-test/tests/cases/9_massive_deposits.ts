/* eslint-disable jest/no-truthy-falsy */
/* eslint-disable jest/no-expect-resolves */
/* eslint-disable jest/require-tothrow-message */
/* eslint-disable jest/no-export */
/* eslint-disable jest/require-top-level-describe */

import { toWei } from 'web3-utils'
import { sleep } from '@zkopru/utils'
import { CtxProvider } from './context'

export const sendETH = (ctx: CtxProvider) => async () => {
  const { wallets, accounts } = ctx()

  const aliceNonce = await wallets.alice.node.layer1.web3.eth.getTransactionCount(
    accounts.alice.ethAddress,
  )
  await Promise.all(
    accounts.users.map((account, i) =>
      wallets.alice.node.layer1.web3.eth.sendTransaction({
        to: account.ethAddress,
        value: toWei('2', 'ether'),
        nonce: aliceNonce + i,
        from: accounts.alice.ethAddress,
      }),
    ),
  )
}

export const aliceDepositEthers33Times = (ctx: CtxProvider) => async () => {
  const { wallets, coordinator } = ctx()

  coordinator.middlewares.proposer.setPreProcessor(_ => undefined)
  let count = 0
  while (count < 33) {
    try {
      const result = await wallets.alice.depositEther(
        toWei('100', 'milliether'),
        toWei('1', 'milliether'),
      )
      if (result) count += 1
    } catch {
      await sleep(1000)
    }
  }
}

export const commitMassDeposit = (ctx: CtxProvider) => async () => {
  const { coordinator } = ctx()
  await coordinator.commitMassDeposits()
  await sleep(1000)
  const pendingMassDeposits = await coordinator
    .layer2()
    .getPendingMassDeposits()
  expect(pendingMassDeposits.leaves).toHaveLength(33)
}

export const waitCoordinatorToProposeANewBlockFor33Deposits = (
  ctx: CtxProvider,
) => async () => {
  const { contract, coordinator } = ctx()
  coordinator.middlewares.proposer.removePreProcessor()
  let msToWait = 60000
  let proposedBlocks!: string
  while (msToWait > 0) {
    proposedBlocks = await contract.upstream.methods.proposedBlocks().call()
    if (proposedBlocks === '5') break
    msToWait -= 1000
    await sleep(1000)
  }
  expect(proposedBlocks).toStrictEqual('5')
}

// TODO Fix that processed block does not count the genesis block (proposed: 2 / processed: 1)
export const waitCoordinatorToProcessTheNewBlockFor33Deposits = (
  ctx: CtxProvider,
) => async () => {
  const { wallets } = ctx()
  let msToWait = 600000
  let success = false
  while (msToWait > 0) {
    const aliceLatestBlock = await wallets.alice.node.layer2.latestBlock()
    const newBlock = await wallets.alice.node.layer2.getBlock(aliceLatestBlock)
    if (newBlock) {
      const prevBlock = await wallets.alice.node.layer2.getBlock(
        newBlock?.header.parentBlock,
      )
      if (
        prevBlock &&
        newBlock.header.utxoIndex
          .toBN()
          .sub(prevBlock.header.utxoIndex.toBN())
          .eqn(64)
      ) {
        success = true
        break
      }
    }
    msToWait -= 1000
    await sleep(1000)
  }
  expect(success).toBeTruthy()
}
