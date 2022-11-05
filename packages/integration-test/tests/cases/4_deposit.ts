import chai from 'chai'

import { sleep } from '~utils'
import { parseUnits } from 'ethers/lib/utils'
import assert from 'assert'
import { CtxProvider } from '../context'

const { expect } = chai

export const depositEther = (ctx: CtxProvider) => async () => {
  const { wallets } = ctx()
  for (const wallet of [wallets.alice, wallets.bob, wallets.carl]) {
    expect(
      await wallet.depositEther(
        parseUnits('10', 'ether'),
        parseUnits('0.001', 'ether'),
      ),
    ).to.be.true
  }
}

export const bobDepositsErc20 = (ctx: CtxProvider) => async () => {
  const { wallets, accounts, tokens, zkopruAddress } = ctx()
  // Get airdrop for the initial balance
  const coordinatorAccount = wallets.coordinator.account
  assert(coordinatorAccount !== undefined)
  assert(wallets.bob.account !== undefined)
  await tokens.erc20.contract
    .connect(coordinatorAccount.ethAccount!)
    .transfer(accounts.bob.ethAddress, parseUnits('100', 'ether'))
  // Approve
  const amount = parseUnits('10', 'ether')
  await tokens.erc20.contract
    .connect(wallets.bob.account.ethAccount!)
    .approve(zkopruAddress, amount)

  // Deposit ERC20
  expect(
    await wallets.bob.depositERC20(
      parseUnits('0', 'ether'),
      tokens.erc20.address,
      amount,
      parseUnits('0.01', 'ether'),
    ),
  ).to.be.true
}

export const depositERC721 = (ctx: CtxProvider) => async () => {
  const { wallets, accounts, tokens, zkopruAddress } = ctx()
  // Send NFT '0' to carl

  assert(wallets.coordinator.account !== undefined)
  assert(wallets.carl.account !== undefined)
  await tokens.erc721.contract
    .connect(wallets.coordinator.account.ethAccount!)
    ['safeTransferFrom(address,address,uint256)'](
      accounts.coordinator.ethAddress,
      accounts.carl.ethAddress,
      '1',
    )
  // Approve
  await tokens.erc721.contract
    .connect(wallets.carl.account.ethAccount!)
    .setApprovalForAll(zkopruAddress, true)
  // Deposit NFT id 1
  expect(
    await wallets.carl.depositERC721(
      parseUnits('0', 'ether'),
      tokens.erc721.address,
      '1',
      parseUnits('0.01', 'ether'),
    ),
  ).to.be.true
}

export const testMassDeposits = (ctx: CtxProvider) => async () => {
  const { coordinator, fixtureProvider } = ctx()
  await coordinator.commitMassDeposits()

  const isSynced = async () => {
    const pendingMassDeposits = await coordinator
      .layer2()
      .getPendingMassDeposits()
    return pendingMassDeposits.leaves.length === 5
  }
  let synced = false
  do {
    await fixtureProvider.advanceBlock(8)
    if (!synced) await sleep(500)
    synced = await isSynced()
  } while (!synced)
  expect(synced).to.eq(true)
}
