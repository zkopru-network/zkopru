import chai from 'chai'
import { BigNumber } from 'ethers'
import { parseUnits } from 'ethers/lib/utils'
import { sleep } from '~utils'
import { CtxProvider } from '../context'

const { expect } = chai

export const sendETH = (ctx: CtxProvider) => async () => {
  const { accounts } = ctx()

  await Promise.all(
    accounts.users.map(account =>
      account.ethAccount!.sendTransaction({
        to: account.ethAddress,
        value: parseUnits('2', 'ether'),
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
        parseUnits('0.1', 'ether'),
        parseUnits('0.001', 'ether'),
      )
      if (result) count += 1
    } catch {
      await sleep(1000)
    }
  }
}

export const commitMassDeposit = (ctx: CtxProvider) => async () => {
  const { coordinator, fixtureProvider } = ctx()
  let pendingDeposits = 0
  do {
    await fixtureProvider.advanceBlock(8)
    await sleep(1000)
    await coordinator.commitMassDeposits()
    await fixtureProvider.advanceBlock(8)
    await sleep(1000)
    pendingDeposits = (await coordinator.layer2().getPendingMassDeposits())
      .leaves.length
  } while (pendingDeposits < 33)
  expect(pendingDeposits).to.eq(33)
}

export const waitCoordinatorToProposeANewBlockFor33Deposits = (
  ctx: CtxProvider,
) => async () => {
  const { contract, coordinator, fixtureProvider } = ctx()
  const prevProposalNum = await contract.zkopru.proposedBlocks()
  coordinator.middlewares.proposer.removePreProcessor()
  let msToWait = 60000
  let proposedBlocks!: BigNumber
  while (msToWait > 0) {
    proposedBlocks = await contract.zkopru.proposedBlocks()
    if (proposedBlocks.gt(prevProposalNum)) break
    msToWait -= 1000
    await fixtureProvider.advanceBlock(8)
    await sleep(1000)
  }
  expect(proposedBlocks).to.be.gt(prevProposalNum)
}

// TODO Fix that processed block does not count the genesis block (proposed: 2 / processed: 1)
export const waitCoordinatorToProcessTheNewBlockFor33Deposits = (
  ctx: CtxProvider,
) => async () => {
  const { wallets, fixtureProvider } = ctx()
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
          .toBigNumber()
          .sub(prevBlock.header.utxoIndex.toBigNumber())
          .eq(64)
      ) {
        success = true
        break
      }
    }
    msToWait -= 1000
    await fixtureProvider.advanceBlock(8)
    await sleep(1000)
  }
  expect(success).to.be.true
}
